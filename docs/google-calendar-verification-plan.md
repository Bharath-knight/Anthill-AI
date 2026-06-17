# Google Calendar Integration — Status & Verification Plan

_Last updated: 2026-06-17_

This doc captures the state of the Google Calendar integration, the research behind the
go-to-market decision, and the step-by-step plan to make it usable by external (especially
`.edu`) users. Goal: don't lose the plan.

---

## 1. Where things stand today

- **Two-way Google Calendar sync is built, verified end-to-end locally, and deployed to production** (`main`, commit `5525566`).
- It works **today for test users** (the Google OAuth app is in **"Testing"** mode): connect, pull (Google → Anthill), push (Anthill → Google), and delete-mirror all confirmed.
- **Code:** `web/lib/google.ts`, `web/lib/google-store.ts`, `web/lib/crypto.ts`, `web/app/api/google/{connect,callback,status,disconnect}`, sync wired into `web/app/api/calendar` + `web/app/api/events`, UI in `web/components/calendar/GoogleCalendarConnect.tsx`.
- **OAuth client:** Google Cloud project number **`927030267892`** (owned by a personal Gmail — NOT a managed `.edu` account, which can't create projects).
- **Scope (current):** `https://www.googleapis.com/auth/calendar` (full, **sensitive**).
- **Redirect URIs registered:** `http://localhost:3000/api/google/callback`, `https://anthill-ai.vercel.app/api/google/callback`.
- **Env vars:** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set in Vercel (Production) and local `.env.local`. DB migration (`GoogleAccount` table etc.) applied to the shared Supabase DB.
- **Test user:** `bharathvishalg4@gmail.com`.

## 2. The problem we're solving

We want **external users — especially Columbia (`.edu`) students, our primary customer base — to connect their Google Calendar.** Today, only explicitly-listed test users can.

## 3. Research findings (2026-06-16, fact-checked against Google's official docs)

### There are TWO independent locks
1. **Google OAuth verification** — ours to solve, with effort.
2. **Each university's Google Workspace admin** — **NOT ours**; a per-school dependency.

### What verification requires (for the sensitive `calendar` scope)
- A **custom domain you own**, DNS-verified in Google Search Console (root-domain TXT / "Domain Property"). **`vercel.app` CANNOT be verified** (we don't control its DNS; it's on the Public Suffix List).
- A **public homepage** + **privacy policy** hosted **on that owned domain**.
- Accurate **consent-screen branding** (app name, logo, support email, homepage URI, privacy URI).
- An **unlisted YouTube demo video** of the OAuth flow (must show the app name, the OAuth client ID in the URL bar, the consent screen, and the calendar feature in-app).
- A **per-scope justification** (incl. why a narrower scope won't work).
- **No CASA security assessment** (that's for _restricted_ scopes like Gmail — not us).
- **Timeline:** Google estimates ~10 business days; often weeks in practice.

### Testing / unverified caveats
- **Testing mode:** ≤100 test users; **each grant expires 7 days after consent** (so even our own connection re-auths weekly until verified); "unverified app" warning.
- **Unverified Production:** capped at **100 new users for the project's lifetime** (non-resettable).

### Narrow-scope alternative (considered, NOT chosen — kept for reference)
- `https://www.googleapis.com/auth/calendar.app.created` is non-sensitive (likely **no verification**) but only writes to a **dedicated app-created calendar** — it **cannot read the user's existing events**. We chose full verification to keep true two-way sync.

### The `.edu` hard dependency (the real risk)
- Workspace admins control third-party app access **independently of Google verification**. **Columbia IT must explicitly trust/allowlist Anthill's OAuth client** for the sensitive calendar scope. Verification ≠ access to managed-domain users.
- The `Access blocked: ...has not completed the Google verification process` (with **no "proceed anyway"**) seen on `bg2879@columbia.edu` is this org-policy block.

**Sources:** [sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [policy compliance](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance), [publishing status & user caps](https://support.google.com/cloud/answer/15549945), [domain verification](https://support.google.com/cloud/answer/13464321), [verification timelines](https://support.google.com/cloud/answer/13463817), [Workspace third-party app controls](https://support.google.com/a/answer/7281227), [OAuth scopes reference](https://developers.google.com/identity/protocols/oauth2/scopes).

## 4. Decision

**Pursue full Google verification and keep the full two-way sync.** Accept that per-school IT allowlisting is a separate dependency we don't control.

## 5. Roadmap

### Phase 1 — Domain & hosting · _owner: you_
- [ ] Buy a custom domain (e.g. `getanthill.com`) — ~$12/yr
- [ ] Add the domain to the Vercel `anthill-ai` project + set the DNS records Vercel provides
- [ ] Verify domain ownership in Google Search Console (one DNS TXT "Domain Property" record)

### Phase 2 — Make the app verification-ready · _owner: Claude (code)_
- [ ] Narrow the scope `calendar` → `calendar.events` (narrowest scope that still supports two-way *event* sync; strengthens the justification)
- [ ] Build a **public landing page** at `/` (currently login-gated → redirects), describing Anthill and linking `/privacy`
- [ ] Ensure the privacy policy is served on the custom domain
- [ ] Point OAuth consent-screen branding + Authorized domains + redirect URIs at the custom domain

### Phase 3 — Submit · _Claude drafts, you finish_
- [ ] Draft the per-scope justification (Claude)
- [ ] Storyboard + script the demo video (Claude)
- [ ] Record the unlisted YouTube demo video (you)
- [ ] Upload the app logo + set consent-screen fields (you)
- [ ] Submit for verification in the Cloud Console (you)
- [ ] Wait for Google review (~10 business days, possibly weeks)

### Phase 4 — `.edu` reality check · _can't skip_
- [ ] After verification, test a `@columbia.edu` connect
- [ ] If still blocked: pursue Columbia IT trust/allowlisting, and/or a Google Workspace Marketplace listing for domain-wide install (lets one school's admin enable it for all its users)

## 6. Quick reference

| Item | Value |
|---|---|
| OAuth project number | `927030267892` |
| Current scope | `https://www.googleapis.com/auth/calendar` → change to `calendar.events` |
| Test user | `bharathvishalg4@gmail.com` |
| Redirect URIs | `http://localhost:3000/api/google/callback`, `https://anthill-ai.vercel.app/api/google/callback` (+ add custom domain) |
| Env vars | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Vercel Production + `.env.local`) |
| Feature commit on `main` | `5525566` |

## 7. Open questions / risks

- Does Columbia (and other target schools) allow verified third-party calendar apps by default, or require explicit per-app allowlisting? (Per-school; the biggest unknown.)
- Is a Google Workspace Marketplace listing a viable scalable `.edu` install path?
- Realistic end-to-end verification wall-clock time including back-and-forth with Google.
