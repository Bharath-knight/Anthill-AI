const DEFAULT_API_URL = 'https://anthill-ai.vercel.app'

const $ = (id) => document.getElementById(id)
const loginSection = $('login-section')
const captureSection = $('capture-section')
const userInfo = $('user-info')
const userEmailEl = $('user-email')

function show(section) {
  loginSection.classList.toggle('active', section === 'login')
  captureSection.classList.toggle('active', section === 'capture')
}

function showAlert(el, msg, kind) {
  el.textContent = msg
  el.className = `alert alert-${kind}`
  el.style.display = 'block'
}

function hideAlert(el) {
  el.style.display = 'none'
}

async function getStored() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['anthillToken', 'anthillUser'], resolve)
  })
}

function setStored(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve))
}

function clearAuthStored() {
  return new Promise((resolve) =>
    chrome.storage.local.remove(['anthillToken', 'anthillUser'], resolve)
  )
}

function setSignedIn(user) {
  userEmailEl.textContent = user?.email || ''
  userInfo.style.display = 'flex'
  show('capture')
}

function setSignedOut() {
  userInfo.style.display = 'none'
  show('login')
}

async function refreshTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]?.url || ''))
  })
}

async function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] || null))
  })
}

// Grab the rendered, post-JS (and post-login) text of the active tab so the server can
// classify/parse pages it can't fetch itself. Requires the "scripting" permission;
// fails silently on restricted pages (chrome://, the web store) — server then falls back.
async function getPageText(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body?.innerText || '',
    })
    return (results?.[0]?.result || '').slice(0, 12000)
  } catch {
    return ''
  }
}

async function init() {
  const stored = await getStored()

  const tabUrl = await refreshTab()
  $('url-display').textContent = tabUrl || '(no active tab)'

  if (stored.anthillToken && stored.anthillUser) {
    setSignedIn(stored.anthillUser)
  } else {
    setSignedOut()
  }
}

$('open-web').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.tabs.create({ url: DEFAULT_API_URL })
})

$('open-signup').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.tabs.create({ url: `${DEFAULT_API_URL}/signup` })
})

$('login-btn').addEventListener('click', async () => {
  const email = $('login-email').value.trim()
  const password = $('login-password').value
  if (!email || !password) {
    showAlert($('login-status'), 'Email and password required.', 'error')
    return
  }
  const apiUrl = DEFAULT_API_URL
  $('login-btn').disabled = true
  $('login-btn').textContent = 'Signing in...'
  hideAlert($('login-status'))
  try {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      showAlert($('login-status'), data.error || 'Login failed.', 'error')
      return
    }
    await setStored({ anthillToken: data.token, anthillUser: data.user })
    $('login-password').value = ''
    setSignedIn(data.user)
  } catch {
    showAlert($('login-status'), 'Cannot reach Anthill API.', 'error')
  } finally {
    $('login-btn').disabled = false
    $('login-btn').textContent = 'Sign in'
  }
})

$('logout-btn').addEventListener('click', async () => {
  await clearAuthStored()
  setSignedOut()
})

$('capture-btn').addEventListener('click', async () => {
  const stored = await getStored()
  if (!stored.anthillToken) {
    setSignedOut()
    return
  }
  const apiUrl = DEFAULT_API_URL
  const tab = await getActiveTab()
  const tabUrl = tab?.url || ''
  if (!tabUrl) {
    showAlert($('capture-status'), 'No active tab to capture.', 'error')
    return
  }
  const pageText = tab.id != null ? await getPageText(tab.id) : ''
  $('capture-btn').disabled = true
  $('capture-btn').textContent = 'Saving...'
  hideAlert($('capture-status'))
  try {
    const res = await fetch(`${apiUrl}/api/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${stored.anthillToken}`,
      },
      body: JSON.stringify({ sourceUrl: tabUrl, pageText }),
    })
    if (res.status === 401) {
      await clearAuthStored()
      setSignedOut()
      showAlert($('login-status'), 'Session expired. Please sign in again.', 'error')
      return
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = res.status === 409 ? 'Already saved.' : (data.error || 'Failed to save.')
      showAlert($('capture-status'), msg, 'error')
      return
    }
    const what = data.type === 'job'
      ? `job — ${[data.company, data.role].filter(Boolean).join(' · ') || 'untitled'}`
      : 'research'
    showAlert($('capture-status'), `Saved ${what}`, 'success')
  } catch {
    showAlert($('capture-status'), 'Cannot reach Anthill API.', 'error')
  } finally {
    $('capture-btn').disabled = false
    $('capture-btn').textContent = 'Capture this page'
  }
})

init()
