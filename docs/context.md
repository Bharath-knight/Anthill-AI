# Anthill MVP — Context

## The Goal

Verify the full capture loop: **Extension → API → DB → UI**
Nothing more until this works cleanly.

---

## Phases

### Phase 1 — Capture loop (current)
Extension sends raw text → `POST /api/capture` → saves to DB → visible at `/items`

Done:
- [x] `POST /api/capture` — unified endpoint, runs parser server-side
- [x] `GET /api/items` — returns all jobs + research for DEV_USER_ID (no auth)
- [x] `/items` page — lists jobs and research items
- [x] Parser centralized in `lib/job-parser.ts` (removed duplication from `popup.js`)

Verify:
- Capture a job from extension → appears in `/items`
- Capture research from extension → appears in `/items`

### Phase 2 — Improve capture quality
Only after Phase 1 loop is confirmed working:
- Fix parser edge cases
- Better handling of missing link (422 flow)

### Phase 3 — Minimal interaction
- Update job status
- Maybe delete

### Phase 4 — Intelligence (later)
- Matching, AI parsing, automation
- Not until Phases 1–3 are solid

---

## What's Cut (intentionally)

- JWT auth — replaced with `DEV_USER_ID` env var for now
- `lib/matcher.ts` and match routes — not needed yet
- Tasks system — not needed yet
- Full dashboard (the existing `/jobs`, `/research`, `/tasks` pages exist but are not the focus)

---

## API Contracts

### POST /api/capture
```
Input:  { type: "job" | "research", rawText: string, sourceUrl?: string }
Output: { type, ...savedRecord }
Errors: 400 (missing fields), 409 (duplicate job), 422 (no link found)
```

### GET /api/items
```
Input:  none (reads DEV_USER_ID from env)
Output: { jobs: Job[], research: ResearchItem[] }
```

---

## Dev Setup Note

Set `DEV_USER_ID` in `web/.env.local` to a real user ID from your DB.
Sign up once at `/signup`, then get your ID from Prisma Studio (`npm run db:studio`).
