# Anthill — Overnight Task Queue

The overnight agent reads this file, picks the **first** task it can work on, builds it
on its own branch, and opens a pull request for you to review in the morning.

## How it picks a task
- It works the **first** line under **## Tasks** that starts with `- [ ]`.
- It **skips** any line tagged `[blocked]`.
- It **skips** any task that already has an open PR (so it never redoes work).
- If there are no eligible tasks, it does nothing that night. Safe to leave empty.

## How to write a good task
Keep each task **specific and self-contained** — the agent does best with a clear,
bounded ask, and worst with vague ones. Add a few indented bullets to spec it out.

Good vs. bad:
```
- [ ] Add a "Delete" button to each row on /jobs that calls DELETE /api/jobs/[id]
      and removes the row from the list on success. Confirm before deleting.
        - Match the existing button styling on that page.
        - Show a toast on error.

  (bad — too vague:)  - [ ] improve the jobs page
```

Tags you can use:
- `[blocked]` — agent will skip it (use for tasks waiting on you or on another task).

---

## Tasks

<!-- Add your real tasks below, one per "- [ ]" line. The agent takes the top one. -->

- [ ] Add a confirmation prompt before deleting a job on /jobs. Right now
      `deleteJob()` in `web/app/(dashboard)/jobs/page.tsx` removes the job
      immediately with no confirmation, which is easy to trigger by accident.
        - Guard the DELETE call with a simple `window.confirm("Delete this job?")`.
        - If the user cancels, do nothing — no API call, no state change.
        - Apply the same guard to research-item deletion if it uses the same pattern.
        - Keep it minimal and match the existing code style.

- [ ] [blocked] Extract company/role/location reliably on common job sites (LinkedIn,
      Greenhouse, Lever, Workday, ZipRecruiter, Indeed) instead of saving them as
      "Unknown Company / Unknown Role". Today `extractJobFields()` in
      `web/app/api/capture/route.ts` runs the LLM over the server-fetched HTML, which for
      these sites is a JS shell or login page with no real content — so it returns nulls
      and we store placeholders.
        - Blocked on: finishing the Layer 1–4 classification work first.
        - Preferred fix (cheap, deterministic, no API cost): the same schema.org
          `JobPosting` JSON-LD we already parse for routing (`hasJobPostingSchema`) also
          carries the fields — `title` (role), `hiringOrganization.name` (company),
          `jobLocation` (location), `validThrough` (deadline). Pull those from the JSON-LD
          first, fall back to the LLM only when JSON-LD is absent. Fixes the named sites.
        - Fallback for sites without JSON-LD: per-host adapters, or Layer 3 (have the
          extension send the rendered page text so the LLM sees real content).
        - Verify: capture a live LinkedIn + Greenhouse + Workday posting and confirm
          company/role are populated, not "Unknown".


## Done
<!-- The agent checks items off (- [x]) on its PR branch; they land here when you merge. -->
