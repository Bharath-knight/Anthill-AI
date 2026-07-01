// Anthill background service worker.
//
// The floating content-script popup never talks to the API directly: it sends
// messages here and the worker performs the fetch. This keeps the auth token in
// one place, sidesteps page CORS/mixed-content, and lets a 401 centrally clear the
// stored session so the action popup falls back to its login screen.

const API_URL = 'https://anthill-ai.vercel.app'
const AUTH_COOKIE = 'anthill_token'

chrome.runtime.onInstalled.addListener(() => {
  console.log('Anthill installed.')
})

function getStored(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve))
}

function syncOpenAnthillTabs(token, user) {
  if (!chrome.tabs) return
  chrome.tabs.query({ url: `${API_URL}/*` }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'ANTHILL_EXTENSION_AUTH_SYNC',
          token,
          user,
        }).catch(() => {})
      }
    }
  })
}

function clearAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['anthillToken', 'anthillUser'], () => {
      chrome.storage.local.set({ anthillSignedOutAt: Date.now() }, () => {
        if (!chrome.cookies) {
          syncOpenAnthillTabs(null, null)
          resolve()
          return
        }
        chrome.cookies.remove({ url: `${API_URL}/`, name: AUTH_COOKIE }, () => {
          syncOpenAnthillTabs(null, null)
          resolve()
        })
      })
    })
  })
}

async function apiPost(path, token, payload) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (res.status === 401) {
    await clearAuth()
    return { authed: false, expired: true }
  }
  const data = await res.json().catch(() => ({}))
  return { authed: true, ok: res.ok, status: res.status, data }
}

// Each handler resolves to the object sent back to the content script.
const handlers = {
  async AUTH_STATUS() {
    const { anthillToken, anthillUser } = await getStored(['anthillToken', 'anthillUser'])
    return { authed: Boolean(anthillToken), user: anthillUser || null }
  },

  async PREVIEW({ url, pageText, pageTitle }) {
    const { anthillToken } = await getStored(['anthillToken'])
    if (!anthillToken) return { authed: false }
    try {
      return await apiPost('/api/preview', anthillToken, { sourceUrl: url, pageText, pageTitle })
    } catch {
      return { authed: true, ok: false, error: 'network' }
    }
  },

  async CAPTURE({ url, pageText, pageTitle }) {
    const { anthillToken } = await getStored(['anthillToken'])
    if (!anthillToken) return { authed: false }
    try {
      return await apiPost('/api/capture', anthillToken, { sourceUrl: url, pageText, pageTitle })
    } catch {
      return { authed: true, ok: false, error: 'network' }
    }
  },

  async OPEN_URL({ url }) {
    await chrome.tabs.create({ url })
    return { ok: true }
  },
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = msg && handlers[msg.type]
  if (!handler) return false
  handler(msg).then(sendResponse).catch(() => sendResponse({ ok: false, error: 'handler' }))
  return true // keep the message channel open for the async response
})
