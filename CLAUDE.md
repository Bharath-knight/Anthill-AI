# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Global behavioral rules (think before coding, simplicity, surgical changes, goal-driven execution) are in `~/.claude/CLAUDE.md`.

## Project Overview

Anthill is a browser extension + synced web app for job and task management.
Flow: **Capture → structure → manage → act**

- **`extension/`** — Chrome extension (plain JS, Manifest V3, no build step): capture layer only
- **`web/`** — Next.js 14 app (App Router, TypeScript, Prisma, Tailwind, custom JWT auth): API + UI

## Commands (run from `web/`)

```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run db:push      # Push Prisma schema to database (use instead of migrate in dev)
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:studio    # Open Prisma Studio GUI
```

No test runner or linter is configured.

## Environment Setup

Copy `web/.env.example` to `web/.env.local` and fill in:
- `DATABASE_URL` — Supabase connection string, transaction mode (port 6543)
- `DIRECT_URL` — Supabase connection string, session mode (port 5432)
- `JWT_SECRET` — random 32-byte hex string

The dual URL setup is required for Prisma with Supabase connection pooling.

## Architecture Constraints

Data flow is strictly one-directional: `extension → API → database → frontend`. No component skips a layer.

- Extension: capture and lightweight preprocessing only — no business logic, no direct DB access
- Backend (`app/api/`): all business logic lives here; validate all inputs; return structured predictable responses; no hidden side effects
- Frontend (`app/(dashboard)/`): pure UI and state — no business logic, all mutations go through the API

Every API route must have a clear input schema and output schema. Prefer explicit JSON structures.

## Architecture Details

## Multi-user authentication & data isolation

**Status:** real per-user auth; `DEV_USER_ID` is no longer used in code.

- **Auth provider:** custom, in-repo. JWT (HS256) signed with `JWT_SECRET`, 30-day expiry, stateless.
- **User table:** `User { id (cuid), email (unique), password (bcrypt cost 12), name, createdAt, updatedAt }`.
- **Sign up / sign in:** `POST /api/auth/signup`, `POST /api/auth/login`. Both return `{ token, user }`.
- **Token storage:** web app uses `localStorage` keys `anthill_token` and `anthill_user`. Extension uses `chrome.storage.local` keys `anthillToken` and `anthillUser`.
- **Per-user scoping:** every user-owned table (`Job`, `ResearchItem`, `Task`) has a `userId` FK to `User` with `onDelete: Cascade`. `Job` has `@@unique([userId, link])` so the same URL can be saved by different users.
- **All API routes** (every route under `app/api/` except `/api/auth/login`, `/api/auth/signup`) call `getAuthUser(request)` from `lib/auth.ts`. The user id is taken from the verified JWT only — `userId` in the request body is ignored.
- **Cross-tenant access:** every read/write uses `where: { ..., userId: auth.userId }`. Attempting to update or delete another user's record returns 404 (no existence leak).
- **Frontend auth helper:** `lib/api-client.ts` exposes `authedFetch()` which attaches `Authorization: Bearer <token>` from `localStorage` and redirects to `/login` on 401.
- **Extension auth:** popup shows login form when no token. After sign in, the token is stored in `chrome.storage.local` and sent on every `/api/capture` request. 401 from capture wipes the stored token and shows the login screen.

### Migration: assigning legacy data to a real user

Existing data (before multi-user lockdown) was owned by a placeholder user id `dev-user-1`. To reassign it to a real user once they sign up:

```bash
# Run from web/
node scripts/reassign-data.mjs --from dev-user-1 --to-email <their-email>
# Optionally remove the now-empty placeholder user:
node scripts/reassign-data.mjs --from dev-user-1 --to-email <their-email> --delete-source
# Preview without writing:
node scripts/reassign-data.mjs --from dev-user-1 --to-email <their-email> --dry-run
```

The script is idempotent. It refuses to run if the target user does not exist yet (so the user must sign up via `/signup` first). It also refuses to merge if the target user already owns a job whose `link` matches one of the source's jobs (no silent overwrite).

### Manual test plan (two-account isolation)

1. Open `https://anthill-ai.vercel.app/signup` in an incognito window. Sign up as user A.
2. From user A: capture a job via the extension; create a task on `/tasks`.
3. Open a second incognito window. Sign up as user B.
4. From user B: confirm `/items`, `/tasks`, `/jobs`, `/research` are empty.
5. From user B: capture a job; confirm it appears.
6. Switch back to user A's window: confirm user B's job is NOT visible.
7. Log out. Hit any of `/items`, `/tasks`, `/jobs`, `/research` — should redirect to `/login`.

The automated equivalent of this is `web/scripts/test-auth-isolation.mjs`:
```bash
# Against local dev (port may differ if 3000 is taken):
node scripts/test-auth-isolation.mjs http://localhost:3000
# Against prod (leaves two `test-*@example.com` user rows behind — clean up via Supabase Studio):
node scripts/test-auth-isolation.mjs https://anthill-ai.vercel.app
```

### Auth pattern (code reference)
All API routes use `getAuthUser(request)` from `lib/auth.ts`. The return type is a union — check for `Response` before proceeding:
```ts
const auth = await getAuthUser(request)
if (auth instanceof Response) return auth
// auth.userId is now available
```
Tokens are HS256 JWTs signed with `JWT_SECRET`, valid for 30 days. Stateless — no session table.

### Database
Prisma client is a singleton in `lib/db.ts` to avoid hot-reload connection leaks. Import `prisma` from there everywhere.

Data model: `User → Job`, `User → Task`, `User → ResearchItem`, `ResearchItem ↔ Task` via `Match`. Jobs have a `@@unique([userId, link])` constraint — duplicate saves return 409.

### Matching
`lib/matcher.ts` implements TF-based cosine similarity. `POST /api/match/run` cross-joins all of a user's research items against their tasks, upserts matches above score `0.05`, and runs all upserts in a single `$transaction`.

### Capture (unified, server-classified)
`POST /api/capture` takes only `{ sourceUrl }` — the extension and the web `PasteCapture` both send just the URL (no `type` field). The server fetches the page (8s timeout, basic SSRF host guard blocking localhost/private/link-local IPs, 5MB cap), strips it to ≤6000 chars, then makes a **single Groq call** (`classifyWithGroq`) returning a discriminated result: `{ kind: 'job', company, role, location, deadline }` or `{ kind: 'research' }`. Routing: `job` → create/dedup `Job` (+ the auto-task), `research` → create `ResearchItem` with `content = pageText`. Classification is **server-only**; the extension stays logic-free. Failure handling is non-destructive: a thin/unreadable page (<200 meaningful chars), a Groq error, or a "job" with neither company nor role all fall back to `research` rather than dropping the capture or fabricating an Unknown job. Genuine single-page borderlines lean `job`; multi-role listing pages go to `research`. The JSON response always carries a top-level `type` so clients route on it.

### Job parsing
`lib/job-parser.ts` is a standalone regex extractor (company/role/location/deadline) that is **not wired into the capture path** — `/api/capture` uses the Groq call above, and `extension/popup.js` only posts the URL (no parsing). Treat job-parser.ts as currently unused by capture; confirm before relying on it.

### Next.js App Router structure
- `app/(auth)/` — login and signup pages
- `app/(dashboard)/` — jobs, research, and tasks pages with shared layout
- `app/api/` — REST API routes (no tRPC or server actions)

### Chrome Extension
No build step — load `extension/` unpacked directly in Chrome. The extension calls the web app's API using a configurable `apiUrl` stored in `chrome.storage.local`. Auth token is also stored there after login.

## Data Handling

- Normalize captured data early in the API layer
- Store both raw and processed versions when useful (e.g. `rawText` + parsed fields on `Job`)
- Avoid lossy transformations

## Verification

For every feature, define before implementing:
1. What success looks like
2. How to verify it (DB state, API response, UI appearance)

Example:
- "Capture job posting" → verify: record in DB with correct fields → verify: appears in `/jobs`
- "Create task from research" → verify: `Match` row created → verify: match visible in UI

## Non-Goals (Current Phase)

- No scalability optimizations
- No microservices
- No advanced caching
- No analytics
- No complex permission systems

## Operational Handoff - 2026-05-07

This section records deployment/debugging state so Codex and Claude share the same memory. Do not add secrets or raw tokens here.

### Production Deployment

- Vercel project: `anthill-ai`
- Vercel team/scope: `bharath-knights-projects`
- Production URL: `https://anthill-ai.vercel.app`
- Vercel project root directory is configured as `web/`.
- When deploying with the Vercel CLI from this repository, run from the repo root, not from `web/`; running from `web/` causes Vercel to look for `web/web`.
- Latest verified deploy added `/privacy` and was aliased to production successfully.
- Verified production endpoints after deploy:
  - `https://anthill-ai.vercel.app/privacy` returns `200`
  - `https://anthill-ai.vercel.app/api/items` returns `200`
  - `https://anthill-ai.vercel.app/api/tasks` returns `200`

### Supabase / Prisma Notes

- Supabase project ref: `xmfbqqgbahsbofimrfay`
- Supabase region: `us-west-2`
- Vercel must use Supabase Supavisor/pooler host, not the IPv6-only direct host.
- Pooler host: `aws-1-us-west-2.pooler.supabase.com`
- Pooler username format: `postgres.xmfbqqgbahsbofimrfay`
- `DATABASE_URL` should use transaction pooling on port `6543` and include `?pgbouncer=true&connection_limit=1`.
- `DIRECT_URL` should use the pooler/session connection on port `5432` for Vercel-hosted Prisma workflows.
- Do not use `db.xmfbqqgbahsbofimrfay.supabase.co` from Vercel. Earlier production logs showed `PrismaClientInitializationError` when Vercel tried to reach that host.
- Required Vercel env keys:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `JWT_SECRET`
  - `GROQ_API_KEY`
  - `DEV_USER_ID`
- Current MVP still relies on `DEV_USER_ID=dev-user-1` for legacy capture/items/tasks routes.

### Chrome Extension Status

- Extension is plain Manifest V3 in `extension/`; no build step.
- Store/test package currently built at `dist/anthill-extension-v1.0.2.zip`.
- Manifest version `1.0.2` removed the unused `clipboardRead` permission.
- Store build permissions are:
  - `activeTab`
  - `storage`
  - host permission for `https://anthill-ai.vercel.app/*`
- Default API URL in `extension/popup.js` is `https://anthill-ai.vercel.app`.
- The popup normalizes any entered API URL to its origin, so `https://anthill-ai.vercel.app/items` becomes `https://anthill-ai.vercel.app`.
- Chrome Web Store privacy policy URL should be `https://anthill-ai.vercel.app/privacy`.

#### v1.1.0 — Rakuten-style clipboard quick-capture (refactor, not yet packaged/published)

- **What it adds:** a content script (`extension/content.js`) injected on all sites listens for `copy`/`cut` events; when the user copies *essentially just a URL*, a Shadow-DOM floating card slides in bottom-right (Ant mascot + preview + "Add to Anthill"/"Dismiss"). The action popup (`popup.html`) is unchanged and remains the login/manual-capture entry point.
- **Architecture:** content script never calls the API directly — it messages `background.js` (service worker), which holds the token in `chrome.storage.local` and performs every fetch (centralizes auth, sidesteps page CORS/mixed-content, a 401 clears the session). UI is fully isolated in a Shadow DOM.
- **New backend route:** `POST /api/preview` (auth-gated, **non-persisting**) returns `{ title, favicon, summary, typeGuess, domain }` for the card. The actual save still goes through `POST /api/capture` (unchanged job/research classification + task creation). Shared SSRF guard / `htmlToText` / job-signal helpers were extracted to `web/lib/capture-utils.ts` (imported by both routes).
- **Once-per-unique-URL:** tracked in `chrome.storage.local` key `anthillHandledUrls` (LRU, cap 500); a URL is marked handled only on terminal close (add-success / dismiss / auto-timeout), never on error, so failures stay retryable.
- **NEW PERMISSIONS (store re-review required):** manifest now requests `http://*/*` + `https://*/*` host permissions and declares an all-sites `content_scripts` entry. This is a material escalation vs. the approved v1.0.2 single-host listing and will need a fresh review + justification: *"runs on all sites to detect when the user copies a link and offer to save it; no remote code; only sends the copied URL (and, when it is the current page, its text) to the Anthill API."* No `clipboardRead` permission is used — the copied text is read from the page selection in the `copy` event.
- **Known boundary:** content scripts can only observe in-page copies; address-bar/omnibox copies and copies in other apps are not observable by any extension API.
- **Not yet done:** no `dist/` zip built for v1.1.0, not submitted. Mascot is an inline SVG (no asset file). A store screenshot + 128px icon are still outstanding (carried over from the v1.0.4 note).

### Chrome Web Store Submission Notes

- **Status: approved on Chrome Web Store** (as of 2026-05-19) using the v1.0.2 build.
- **Extension ID:** `icnlhamakppnmmplljlhjacmjeaidfhl`
- **Public install link (Unlisted):** `https://chromewebstore.google.com/detail/anthill/icnlhamakppnmmplljlhjacmjeaidfhl` — share this with users for onboarding.
- Developer dashboard item URL (publisher-only, requires sign-in as `mgmsreviji@gmail.com`): `https://chrome.google.com/u/1/webstore/devconsole/c065d297-d1f7-4828-8d4c-4e5b118e5c69/icnlhamakppnmmplljlhjacmjeaidfhl/edit`
- Recommended distribution for testing: Unlisted.
- Data usage selections should include `Website content`; `Web history` may also be appropriate because the extension sends the current tab URL when the user clicks capture.
- Do not select clipboard data unless `clipboardRead` is reintroduced and implemented.
- Permission justifications used:
  - `activeTab`: Used only when the user clicks "Capture This Job" to access the current active tab URL and send that URL to the Anthill API.
  - `storage`: Used to remember the Anthill API URL so the user does not need to enter it every time.
  - Host permission: Used to send the captured job posting URL to the Anthill web app API at `https://anthill-ai.vercel.app`.
- Remote code answer: No. The extension does not load or execute remote JavaScript; it only sends HTTPS API requests to the Anthill backend.
- Publisher contact email was added and verified in the Chrome dashboard prior to approval.

### Security Cleanup Reminder

- Supabase/Vercel/Groq tokens and credentials were discussed during debugging. Treat any pasted token as compromised after the session.
- Revoke short-lived Supabase PATs after use.
- Rotate Groq keys and database password if they were pasted into chat or transcripts.
- Never commit `.env`, `.env.local`, `.env.production`, Vercel tokens, Supabase PATs, or API keys.
