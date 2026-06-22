# Auto-publishing the Chrome extension

The extension is uploaded to the Chrome Web Store automatically when you push a
version tag. The upload is a **draft** — it is *not* submitted for review. You
click **Publish** in the dashboard when you're ready (the final gate stays
manual on purpose).

Workflow: [`.github/workflows/extension-publish.yml`](../.github/workflows/extension-publish.yml)

## How to ship a new version

1. Bump `"version"` in `extension/manifest.json` (e.g. `1.0.6`).
2. Commit and merge to `main`.
3. Tag and push:
   ```bash
   git tag v1.0.6
   git push origin v1.0.6
   ```
   The tag must match the manifest version or the workflow fails the build.
4. The Action packages `extension/` and uploads it as a draft.
5. Open the [Chrome Web Store dashboard](https://chrome.google.com/webstore/devconsole),
   review the draft, and click **Publish** to submit for review.

> Publishing still goes through Chrome Web Store review. The Action only
> uploads + drafts; it never bypasses review.

## One-time setup: API credentials (do this once)

You add three repo secrets. Generating them requires *your* Google login — it
can't be done for you.

### 1. Google Cloud project + API
- Go to the [Google Cloud Console](https://console.cloud.google.com/), create or
  pick a project.
- **APIs & Services -> Library** -> enable **Chrome Web Store API**.

### 2. OAuth consent screen
- **APIs & Services -> OAuth consent screen** -> User type **External**.
- Add your developer email (`mgmsreviji@gmail.com`) as a **Test user**.
- Add the scope `https://www.googleapis.com/auth/chromewebstore`.
  (Staying in "Testing" mode is fine — no app verification needed for your own
  publishing.)

### 3. OAuth client
- **APIs & Services -> Credentials -> Create credentials -> OAuth client ID**.
- Application type: **Desktop app**.
- Copy the **Client ID** and **Client secret**.

### 4. Refresh token
Run the helper from the repo root (Node 18+):
```bash
node scripts/get-cws-token.mjs <CLIENT_ID> <CLIENT_SECRET>
```
It opens a Google consent page, you approve, and it prints a **refresh token**.

### 5. Add the GitHub secrets
**Repo Settings -> Secrets and variables -> Actions -> New repository secret:**

| Secret               | Value                          |
| -------------------- | ------------------------------ |
| `CWS_CLIENT_ID`      | Client ID from step 3          |
| `CWS_CLIENT_SECRET`  | Client secret from step 3      |
| `CWS_REFRESH_TOKEN`  | Refresh token from step 4      |

That's it — the next `v*` tag push will upload a draft.

## Notes
- Extension ID (`icnlhamakppnmmplljlhjacmjeaidfhl`) is public, so it's hardcoded
  in the workflow rather than stored as a secret.
- A refresh token can stop working if the OAuth client is deleted or access is
  revoked; re-run step 4 to mint a new one.
- This pipeline runs on GitHub Actions (free) — no extra cost.
