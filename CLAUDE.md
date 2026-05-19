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

### Auth pattern
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

### Job parsing
`lib/job-parser.ts` extracts company, role, location, and deadline from free-form job posting text using regex. **The same logic is duplicated in `extension/popup.js`** — the extension cannot import server modules, so both files must be kept in sync manually when parser logic changes.

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

### Chrome Web Store Submission Notes

- **Status: approved on Chrome Web Store** (as of 2026-05-19) using the v1.0.2 build.
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
