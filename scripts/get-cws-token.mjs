// One-time helper: generate a Chrome Web Store API refresh token.
//
// Prereq: a Google Cloud OAuth client of type "Desktop app" with the Chrome
// Web Store API enabled (see docs/extension-publishing.md).
//
// Usage:
//   node scripts/get-cws-token.mjs <CLIENT_ID> <CLIENT_SECRET>
//
// It opens a Google consent page in your browser, captures the auth code on a
// local loopback server, exchanges it, and prints the refresh token. Paste
// that token into the CWS_REFRESH_TOKEN GitHub secret.

import http from 'node:http'
import { exec } from 'node:child_process'

const [clientId, clientSecret] = process.argv.slice(2)
if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/get-cws-token.mjs <CLIENT_ID> <CLIENT_SECRET>')
  process.exit(1)
}

const PORT = 8818
const redirectUri = `http://localhost:${PORT}`
const scope = 'https://www.googleapis.com/auth/chromewebstore'
const authUrl =
  'https://accounts.google.com/o/oauth2/auth?response_type=code' +
  `&scope=${encodeURIComponent(scope)}` +
  '&access_type=offline&prompt=consent' +
  `&client_id=${encodeURIComponent(clientId)}` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}`

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirectUri).searchParams.get('code')
  if (!code) { res.statusCode = 400; res.end('No authorization code received.'); return }
  res.end('Got it — you can close this tab and return to the terminal.')
  server.close()

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const json = await resp.json()
  if (json.refresh_token) {
    console.log('\n=== CWS_REFRESH_TOKEN ===\n' + json.refresh_token + '\n')
    console.log('Add this as the CWS_REFRESH_TOKEN secret in GitHub. Done.')
  } else {
    console.error('No refresh_token in response. Full response:')
    console.error(JSON.stringify(json, null, 2))
    process.exitCode = 1
  }
})

server.listen(PORT, () => {
  console.log('Opening Google consent screen. If it does not open, paste this URL:\n\n' + authUrl + '\n')
  const opener = process.platform === 'win32' ? 'start ""'
    : process.platform === 'darwin' ? 'open' : 'xdg-open'
  exec(`${opener} "${authUrl}"`)
})
