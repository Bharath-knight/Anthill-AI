# Anthill AI Feature Status

Last updated: 2026-06-27  
Branch reviewed: `ci/publish-workflow-on-main`  
Primary app: `web/` Next.js application  
Browser extension: `extension/` Chrome MV3 extension

This document captures the current state of Anthill AI as implemented in this
repository. It is intended to be a detailed handoff/status reference for review,
planning, QA, and future development.

## Executive Summary

Anthill AI is currently a working personal workspace for capturing job postings
and research from the web, organizing saved jobs into tasks, matching research
to tasks, and planning work on a calendar. The product has two major surfaces:

- A Next.js web app backed by PostgreSQL/Prisma.
- A Chrome extension that captures pages and copied URLs into the web app.

The implemented feature set now extends beyond the original MVP capture loop.
Core pieces present in the codebase include:

- Email/password authentication.
- Google Sign-In as an identity-only login option.
- Auth-scoped jobs, research, tasks, matches, and calendar data.
- Extension-driven capture with rendered page text support.
- Floating quick-capture popup for copied URLs.
- Server-side preview generation for extension cards.
- Job/research classification with deterministic signals plus optional Groq LLM
  fallback.
- Job field extraction with optional Groq LLM fallback.
- Automatic task creation for every captured or manually created job.
- Task views patterned after smart lists: All, Today, Next 7 Days, Upcoming, No
  Date, and Completed.
- Calendar views: week, month, agenda.
- Calendar event create/update/delete.
- Derived task deadlines and calendar suggestions.
- Separate Google Calendar connection and two-way sync.
- Chrome Web Store draft-upload workflow triggered by version tags.

The repo also contains open follow-up work, especially around frontend delete
confirmation and higher-quality job field extraction from common job sites.

## Repository Layout

```text
anthill/
  web/                     Next.js app, Prisma schema, API routes, UI
  extension/               Chrome MV3 extension
  docs/                    Project documentation
  scripts/                 Utility scripts, including Chrome Web Store token helper
  .github/workflows/       GitHub Actions workflows
  store-assets/            Chrome Web Store listing assets
  dist/                    Build/distribution output
```

Notable docs already present:

- `SETUP.md`: original setup instructions. Some extension details are now stale
  because the extension no longer has an editable API URL.
- `TODO.md`: overnight-agent task queue and current known tasks.
- `docs/context.md`: older MVP capture-loop context. Useful history, but no
  longer complete.
- `docs/extension-publishing.md`: Chrome Web Store draft-upload workflow.

## Technology Stack

Web app:

- Next.js 14 App Router.
- React 18.
- TypeScript.
- Tailwind CSS.
- Prisma 5.
- PostgreSQL through `DATABASE_URL` and `DIRECT_URL`.
- JWT auth with `jose`.
- Password hashing with `bcryptjs`.
- Icons from `lucide-react`.

Extension:

- Chrome Manifest V3.
- Popup UI plus background service worker.
- Content script with Shadow DOM quick-capture card.
- `chrome.storage.local` for session and handled-URL state.
- `chrome.scripting` to read rendered page text when permitted.

External services:

- Vercel-hosted production API: `https://anthill-ai.vercel.app`.
- Google OAuth for Sign-In and Calendar.
- Google Calendar API.
- Groq API for optional classification, extraction, and preview summaries.
- Chrome Web Store API for draft extension uploads.

## Environment Variables

The web app depends on these major environment variables:

- `DATABASE_URL`: Prisma transaction/pooler database URL.
- `DIRECT_URL`: Prisma direct database URL.
- `JWT_SECRET`: signing secret for app JWTs.
- `NEXT_PUBLIC_APP_URL`: public app URL used in deployment contexts.
- `GROQ_API_KEY`: optional. Enables LLM preview summaries, classification, and
  job field extraction. Without this, the capture flow still works using
  deterministic fallbacks.
- Google OAuth variables used by `web/lib/google.ts` and `web/lib/google-auth.ts`
  for Calendar connection and Google Sign-In.
- Encryption secret/key material used by `web/lib/crypto.ts` for Google Calendar
  token storage.

The extension currently hardcodes the production API URL in both `popup.js` and
`background.js`.

## Data Model

The Prisma schema currently defines:

- `User`
  - Email is unique.
  - Password is nullable, which allows Google-created accounts.
  - `googleId` is unique and used for Google Sign-In identity linkage.
  - Owns jobs, research, tasks, calendar events, and one Google Calendar account.

- `Job`
  - Belongs to one user.
  - Stores company, role, location, deadline, link, raw text, notes, and status.
  - Status enum: `SAVED`, `APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`.
  - Unique per user/link.
  - Has linked tasks and status-change events.

- `JobEvent`
  - Tracks job status changes.
  - Currently records type, from-status, to-status, and timestamp.

- `ResearchItem`
  - Belongs to one user.
  - Stores captured content, source URL, domain, and matches.

- `Task`
  - Belongs to one user.
  - Stores title, optional description, optional deadline, completion state, and
    optional linked job.

- `Match`
  - Joins research items to tasks.
  - Stores score, matched keywords, status, and timestamp.
  - Status enum: `PENDING`, `ACCEPTED`, `REJECTED`.
  - Unique per research item/task pair.

- `CalendarEvent`
  - Belongs to one user.
  - Stores title, start/end, all-day flag, type, notes, and source.
  - Type enum: `JOB`, `RESEARCH`, `PERSONAL`, `FOCUS`.
  - Source enum: `ANTHILL`, `GOOGLE`.
  - Stores Google event ID and Google updated timestamp for sync.

- `GoogleAccount`
  - One per user.
  - Stores Google email, encrypted access/refresh tokens, expiry, scope, and
    sync token.

## Authentication Status

### Email/password auth

Implemented:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- JWT signing and verification in `web/lib/auth.ts`.
- App API routes use Bearer tokens.
- The client stores the token in `localStorage` as `anthill_token`.
- Unauthorized API calls return `401`.

Current behavior:

- JWTs expire after 30 days.
- Auth is API-level; pages redirect to `/login` when no token is found.
- CORS headers are applied to API routes through `web/middleware.ts`.

Important caveat:

- `JWT_SECRET` must be present. `web/lib/auth.ts` assumes it exists.

### Google Sign-In

Implemented:

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `/complete` page for receiving the JWT in the URL fragment.
- `GoogleButton` component on auth pages.

Security decisions already made:

- Google Sign-In is identity-only. It does not grant Calendar access.
- The OAuth state is signed.
- A per-browser nonce is stored in an HttpOnly cookie and checked on callback to
  reduce login-CSRF/session-fixation risk.
- The callback only links by email when Google says the email is verified.
- Existing accounts are linked only when doing so does not conflict with an
  existing `googleId`.
- The JWT is returned through the URL fragment, not the query string.

Current behavior:

- A user can sign in with Google.
- A user with an existing password account can be linked by verified email.
- A new user can be created from a verified Google profile.

## Extension Status

Current extension version: `1.1.0`.

Manifest permissions:

- `activeTab`
- `storage`
- `scripting`

Host permissions:

- `https://anthill-ai.vercel.app/*`
- `http://*/*`
- `https://*/*`

### Action popup

Implemented in `extension/popup.js`, `popup.html`, and `popup.css`.

Current behavior:

- Uses fixed API URL: `https://anthill-ai.vercel.app`.
- Shows login UI when no token/user is stored.
- Calls `POST /api/auth/login`.
- Stores `anthillToken` and `anthillUser` in `chrome.storage.local`.
- Shows signed-in email.
- Supports logout by clearing stored auth.
- Reads the active tab URL.
- Uses `chrome.scripting.executeScript` to collect rendered `document.body.innerText`
  up to 12,000 characters where allowed.
- Sends `sourceUrl` and rendered `pageText` to `POST /api/capture`.
- Handles expired sessions by clearing auth on `401`.
- Shows success/error messages in the popup.

Known boundaries:

- Rendered text capture can fail on restricted pages such as `chrome://` pages or
  pages where extension scripting is not permitted.
- The extension falls back to server-side fetch/classification when page text is
  unavailable.

### Background service worker

Implemented in `extension/background.js`.

Current behavior:

- Centralizes API calls for the floating content-script card.
- Keeps content scripts from talking directly to the API.
- Handles:
  - `AUTH_STATUS`
  - `PREVIEW`
  - `CAPTURE`
  - `OPEN_URL`
- Clears stored auth on `401`.
- Calls:
  - `POST /api/preview`
  - `POST /api/capture`

### Floating quick-capture popup

Implemented in `extension/content.js`.

Current behavior:

- Runs as a content script on web pages.
- Listens to in-page `copy` and `cut` events.
- Only triggers when the selected text is essentially just a URL.
- Ignores non-HTTP(S) URLs, local/private-looking hosts, and the Anthill app
  itself.
- Normalizes copied URLs by removing fragments.
- Keeps a capped list of handled URLs in `chrome.storage.local` to avoid repeated
  prompts.
- Shows one Shadow DOM card at a time.
- Uses a preview request before saving.
- Offers:
  - Dismiss.
  - Add to Anthill.
  - Sign in when unauthenticated.
  - Retry on network/update failures.
- Includes light/dark styling and reduced-motion handling.
- Auto-dismisses after a timeout unless hovered.

Known boundary:

- Browser extensions cannot observe address-bar/omnibox copies or copies made in
  other apps. The content script only sees copy/cut events inside web pages.

## Capture, Preview, and Classification

### Preview API

Implemented: `POST /api/preview`.

Purpose:

- Build a non-persisting preview for the extension card before the user saves.

Inputs:

- `sourceUrl` is required.
- Optional `pageText`.
- Optional `pageTitle`.

Behavior:

- Requires auth.
- Validates URL protocol.
- Blocks disallowed hosts through `isBlockedHost`.
- Fetches page HTML with a timeout.
- Extracts title from Open Graph/Twitter/title tags.
- Extracts favicon from page links with safety checks.
- Falls back to Google favicon service.
- Converts HTML to text.
- Prefers rendered client text when it is more substantial than server text.
- Uses Groq for a one-sentence summary when `GROQ_API_KEY` is present and enough
  text exists.
- Falls back to meta description when LLM summary is unavailable.
- Returns title, favicon, summary, type guess, and domain.

Type guessing:

- Uses `JobPosting` schema and job-looking URLs.
- Preview type is coarse: `job` or `link`.

### Capture API

Implemented: `POST /api/capture`.

Purpose:

- Persist a page as either a `Job` or a `ResearchItem`.

Inputs:

- `sourceUrl` is required.
- Optional `pageText` from the extension.

Behavior:

- Requires auth.
- Validates URL protocol.
- Blocks disallowed hosts.
- Attempts server-side fetch with timeout and size protection.
- Allows server fetch failure when rendered client text is present.
- Converts server HTML to text.
- Prefers rendered client text when more substantial.
- Uses three-layer routing:
  - Layer 1 deterministic signals: `JobPosting` JSON-LD and job-looking URL.
  - Layer 2 optional Groq classification when deterministic signals are absent
    but page text is substantial.
  - Layer 3 rendered extension text for JS-rendered or login-walled pages.
- Treats pages without positive job evidence as research.
- Deduplicates research by `userId` plus `sourceUrl` using a lookup.
- Deduplicates jobs by Prisma unique constraint `userId + link`.
- Updates existing unknown job fields if a later capture extracts better values.
- Creates a linked task for every new job.

Job extraction:

- Uses Groq when `GROQ_API_KEY` is present and meaningful text exists.
- Extracts company, role, location, and deadline.
- Treats the page text as untrusted in the prompt.
- Falls back to:
  - `Unknown Company`
  - `Unknown Role`
  - `Deadline not given`
  - `null` location

Known gap:

- The code detects `JobPosting` schema for routing, but it does not yet extract
  company/role/location/deadline directly from JSON-LD. This is called out in
  `TODO.md` and would likely improve LinkedIn, Greenhouse, Lever, Workday,
  ZipRecruiter, and Indeed captures.

## Jobs Feature Status

Implemented API:

- `GET /api/jobs`
- `POST /api/jobs`
- `PATCH /api/jobs/[id]`
- `DELETE /api/jobs/[id]`
- `POST /api/jobs/[id]/reclassify`

Current API behavior:

- All job routes are auth-scoped.
- `GET /api/jobs` supports optional company, location, and status filters.
- `POST /api/jobs` requires company, role, and link.
- `POST /api/jobs` creates an automatic linked task.
- `PATCH /api/jobs/[id]` can update status, company, role, location, deadline,
  and notes.
- Status changes create `JobEvent` rows.
- `DELETE /api/jobs/[id]` deletes only if the job belongs to the authenticated
  user.

Implemented UI:

- `/jobs` dashboard page.
- Job list with count.
- Company filter.
- Location filter.
- Status filter.
- Empty state.
- Status update from the job card.
- Delete action from the job card.

Known gap:

- Deleting a job currently has no confirmation prompt in the page code. This is
  the first open task in `TODO.md`.

## Research Feature Status

Implemented API:

- `GET /api/research`
- `POST /api/research`
- `POST /api/research/[id]/reclassify`

Current API behavior:

- Research routes are auth-scoped.
- Research items include their matches and matched task titles.
- Manual research creation accepts content, source URL, and domain.
- Domain can be derived from source URL.

Implemented UI:

- `/research` dashboard page.
- Research list with domain, capture date, source link, and content excerpt.
- Empty state.
- Run matching button.
- Matched task display.
- Accept/reject controls for pending matches.

Known gaps:

- Research deletion is not implemented in the displayed `/research` page.
- The TODO references applying delete confirmation to research deletion if it
  shares the same pattern, but this page currently does not expose deletion.

## Matching Feature Status

Implemented:

- `POST /api/match/run`
- `PATCH /api/match/[id]`
- `web/lib/matcher.ts`

Current behavior:

- Matching is auth-scoped.
- The run endpoint loads all research items and all tasks for the current user.
- It computes a keyword-overlap score.
- It upserts matches above a low threshold of `0.05`.
- Match records store score and matched keywords.
- Users can mark matches as `ACCEPTED` or `REJECTED`.

Limitations:

- Matching is deterministic keyword overlap, not embeddings or semantic search.
- The threshold is intentionally permissive.
- Existing match status can be overwritten by the upsert update path if the same
  pair is recomputed, depending on Prisma update data. The current update changes
  score and keywords, not status.

## Tasks Feature Status

Implemented API:

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/[id]`
- `DELETE /api/tasks/[id]`

Current API behavior:

- All task routes are auth-scoped.
- Tasks include selected linked job fields.
- Task creation supports title, description, deadline, and optional linked job.
- If `linkedJobId` is provided, the API verifies it belongs to the user.
- Task patch supports completed, title, description, and deadline.
- Task delete is user-scoped.

Implemented UI:

- `/tasks` page.
- `AppShell` layout.
- Smart-list views:
  - All
  - Today
  - Next 7 Days
  - Upcoming
  - No date
  - Completed
- Quick-add input.
- Optional linked-job selector in quick-add.
- Deadline seeding based on the active smart-list view.
- Optimistic checkbox completion.
- Completed task section.
- Task detail pane.
- Delete support.
- Toasts for failures.

Current behavior:

- The page loads tasks and jobs.
- Jobs are loaded through `/api/items` and used for the linked-job selector.
- Sidebar `+ New task` can focus the quick-add input.
- Edits are optimistic; failed saves show a toast but do not fully reconcile all
  possible field changes back from the server.

## Items / Unified Workspace Status

Implemented:

- `GET /api/items`
- `/items` page.

Purpose:

- Provide a unified development/test view of jobs and research.
- Support task page job selector.

Current behavior:

- Returns jobs and research for the authenticated user.
- The older `docs/context.md` describes a DEV_USER_ID-based no-auth MVP, but the
  current code has moved to bearer-token auth.

## Calendar Feature Status

Implemented API:

- `GET /api/calendar`
- `POST /api/events`
- `PATCH /api/events/[id]`
- `DELETE /api/events/[id]`

Implemented UI:

- `/calendar` page.
- Week view.
- Month view.
- Agenda view.
- Calendar header controls.
- Event editor modal/panel.
- Context panel.
- Google Calendar connect/disconnect component.
- Task deadline markers.
- Upcoming task context.
- Suggestions such as prep/deep-work blocks.

Current behavior:

- Calendar reads visible range using `start` and `end` query params.
- Pulls and reconciles Google Calendar events before returning local calendar data
  when the user is connected.
- Returns:
  - persisted events,
  - derived deadlines,
  - upcoming tasks,
  - suggestions.
- Event create/update/delete writes locally.
- Google push is attempted after local writes and is non-fatal.
- Deadline clicks route to `/tasks` because deadlines are derived from tasks.

Event types:

- `JOB`
- `RESEARCH`
- `PERSONAL`
- `FOCUS`

Google-origin events:

- Stored locally with `source = GOOGLE`.
- Removed on disconnect.
- Removed if they disappear from Google in the requested range.

Known risks:

- Google pull happens during calendar reads. If Google API latency rises, calendar
  page loads may slow down.
- Sync is range-based. Behavior for events outside the currently requested range
  depends on future reads of those ranges.
- There is no explicit conflict-resolution UI; pull uses Google updated timestamps
  and local writes push to Google.

## Google Calendar Sync Status

Implemented:

- `GET /api/google/connect`
- `GET /api/google/callback`
- `GET /api/google/status`
- `POST /api/google/disconnect`
- Token persistence in `GoogleAccount`.
- Encrypted token storage.
- Access-token refresh.
- Pull from Google.
- Push create/update/delete to Google.

Architecture decisions:

- Google Sign-In and Google Calendar connection are separate.
- Calendar OAuth requires an authenticated Anthill user.
- Callback uses signed state to recover user identity because top-level Google
  redirects do not include the Bearer token.
- One Google account per Anthill user.
- MVP sync targets the primary calendar.
- Local writes should still succeed if Google push fails.

Current sync semantics:

- Pull:
  - Create local rows for new Google events.
  - Update local Google-origin rows when Google has a newer updated timestamp.
  - Delete local Google-origin rows for cancelled/missing Google events within
    the viewed range.
- Push:
  - Create Google event for new Anthill event when connected.
  - Patch Google event for updated Anthill event.
  - Delete Google event for deleted Anthill event when linked to Google.

## Reclassification Status

Files present:

- `web/app/api/jobs/[id]/reclassify/route.ts`
- `web/app/api/research/[id]/reclassify/route.ts`

Purpose:

- Let captured records be moved or reinterpreted after initial classification.

Status:

- Routes exist and should be included in future QA, but they were not deeply
  reviewed for this document beyond confirming their presence.

## Deployment and Publishing Status

### Web app

Current assumptions:

- Vercel is the intended deployment target.
- Production URL is `https://anthill-ai.vercel.app`.
- Database is PostgreSQL, likely Supabase based on setup docs.

Scripts:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run db:push`
- `npm run db:generate`
- `npm run db:studio`

### Extension publishing

Implemented:

- `.github/workflows/extension-publish.yml`
- `scripts/get-cws-token.mjs`
- `docs/extension-publishing.md`

Current behavior:

- Pushing a `v*` tag triggers the workflow.
- The workflow checks that the tag version matches `extension/manifest.json`.
- The workflow zips `extension/`.
- The workflow uploads the extension to the Chrome Web Store as a draft.
- It does not publish/submit for review automatically.
- Manual publish remains the final gate in the Chrome Web Store dashboard.

Configured extension ID:

- `icnlhamakppnmmplljlhjacmjeaidfhl`

Required GitHub secrets:

- `CWS_CLIENT_ID`
- `CWS_CLIENT_SECRET`
- `CWS_REFRESH_TOKEN`

## Current Branch and Recent Work

Current branch at time of documentation:

- `ci/publish-workflow-on-main`

Recent commit history shows these milestones:

- Chrome Web Store listing assets.
- Chrome Web Store auto-upload workflow on version tags.
- Clipboard quick-capture extension popup.
- Fixed production API URL in the extension and removed editable URL field.
- Google Sign-In hardened and kept identity-only.
- Two-way Google Calendar sync.
- Extension sending rendered page text on capture.
- Capture classification as job vs research.
- All-task view, clearer task adding, and automatic task for every job.
- UI redesign and auth-scoped APIs.
- Calendar views and events API.
- Maintenance/test scripts.

## Known Open Work

From `TODO.md` and code review:

1. Add delete confirmation before deleting jobs.
   - Current page code deletes immediately.
   - Suggested minimal fix: wrap the delete call with
     `window.confirm("Delete this job?")`.

2. Improve job field extraction on common job sites.
   - Current routing detects `JobPosting` schema but extraction does not yet pull
     fields from JSON-LD.
   - Recommended next step: parse `JobPosting` JSON-LD for title, hiring
     organization, location, and deadline before falling back to the LLM.
   - This should reduce `Unknown Company` and `Unknown Role` on LinkedIn,
     Greenhouse, Lever, Workday, ZipRecruiter, and Indeed.

3. Refresh stale setup docs.
   - `SETUP.md` still describes entering an API URL in the extension.
   - Current extension uses a fixed production API URL.

4. QA reclassification routes.
   - Routes exist, but this document did not validate end-to-end behavior.

5. Add/confirm automated tests.
   - Scripts exist under `web/scripts`, but there is no standard test script in
     `web/package.json`.
   - Current package scripts do not include `test`.

6. Review CORS posture.
   - API middleware currently allows all origins.
   - This may be acceptable for extension-driven API access plus Bearer auth, but
     it should be revisited before broader public rollout.

7. Consider token/session storage hardening.
   - Web app uses localStorage for JWTs.
   - Extension uses `chrome.storage.local`.
   - This is pragmatic for the current architecture, but the security posture
     should be revisited if the app becomes multi-user/public.

8. Monitor calendar sync performance.
   - Calendar reads can trigger Google pull/reconcile.
   - Future optimization may need background sync, caching, or user-triggered
     refresh.

## QA Checklist

Use this as the next review pass.

Authentication:

- Sign up with email/password.
- Log in with email/password.
- Log out.
- Confirm API calls without token return `401`.
- Google Sign-In creates a new user.
- Google Sign-In links to an existing verified-email user.
- Google Sign-In does not connect Calendar automatically.

Extension:

- Install unpacked extension from `extension/`.
- Log in from the action popup.
- Capture a normal article page.
- Capture a job page.
- Capture a JS-rendered job page where server fetch is thin.
- Confirm duplicate capture behavior.
- Confirm expired token clears extension auth.
- Copy a URL inside a webpage and confirm the floating card appears.
- Confirm the floating card does not appear for paragraphs containing links.
- Confirm copied local/private URLs are ignored.

Jobs:

- Save a job from extension.
- Confirm it appears on `/jobs`.
- Confirm a linked task is created.
- Filter by company/location/status.
- Change status and confirm persistence.
- Confirm `JobEvent` is created for status changes.
- Delete a job after adding frontend confirmation.

Research:

- Save research from extension.
- Confirm it appears on `/research`.
- Confirm source link and domain display.
- Run matching.
- Accept a match.
- Reject a match.

Tasks:

- Create a task from each smart-list view.
- Confirm deadline seeding works for date-based views.
- Link a task to a job.
- Complete/uncomplete a task.
- Edit task detail fields.
- Delete a task.
- Confirm completed tasks show in the completed section/view.

Calendar:

- Create an event.
- Edit an event.
- Delete an event.
- Switch week/month/agenda views.
- Confirm task deadlines show.
- Confirm deadline click routes to tasks.
- Confirm suggestions can create draft focus blocks.

Google Calendar:

- Connect Calendar from `/calendar`.
- Confirm Google account status displays.
- Create Anthill event and confirm it appears in Google Calendar.
- Edit Anthill event and confirm Google updates.
- Delete Anthill event and confirm Google deletion.
- Create Google event and confirm Anthill pulls it into the visible range.
- Edit Google event and confirm Anthill updates after refresh.
- Delete Google event and confirm Anthill removes the Google-origin local row.
- Disconnect Google and confirm Google-origin events are removed locally.

Publishing:

- Bump `extension/manifest.json` version.
- Commit and merge to `main`.
- Tag `v<manifest-version>`.
- Push tag.
- Confirm GitHub Action uploads a draft, not a published release.

## Suggested Next Milestones

Near-term:

- Add job delete confirmation.
- Add JSON-LD field extraction for job captures.
- Update `SETUP.md` to match fixed production API URL.
- Add a basic `npm run build` CI check for `web/`.
- Add smoke-test instructions for extension capture and calendar sync.

Medium-term:

- Add a standard `test` script.
- Add route-level tests for auth scoping and capture classification.
- Add calendar sync tests around push/pull/delete cases.
- Improve matching beyond keyword overlap if product value depends on semantic
  associations.
- Add user-visible controls for recapturing/reclassifying items.

Longer-term:

- Move expensive sync/classification work out of request/response where needed.
- Improve observability around capture failures, Groq failures, and Google sync
  failures.
- Revisit token storage and CORS before larger public usage.
- Add richer onboarding for extension install/sign-in/capture.

## Review Notes

This document was created from the repository state, source files, and recent git
history. It intentionally documents the implemented code rather than only the
older MVP notes. Where older docs conflict with current code, current code is
treated as the source of truth.
