const DEFAULT_API_URL = 'https://anthill-ai.vercel.app'

const $ = (id) => document.getElementById(id)
const loginSection = $('login-section')
const captureSection = $('capture-section')
const userInfo = $('user-info')
const userEmailEl = $('user-email')

function normalizeApiUrl(value) {
  if (!value) return ''
  try { return new URL(value.trim()).origin } catch { return '' }
}

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
    chrome.storage.local.get(['apiUrl', 'anthillToken', 'anthillUser'], resolve)
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

async function getApiUrl() {
  const stored = await getStored()
  return normalizeApiUrl(stored.apiUrl || DEFAULT_API_URL) || DEFAULT_API_URL
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

async function init() {
  const stored = await getStored()
  $('api-url-input').value = normalizeApiUrl(stored.apiUrl || DEFAULT_API_URL) || DEFAULT_API_URL

  const tabUrl = await refreshTab()
  $('url-display').textContent = tabUrl || '(no active tab)'

  if (stored.anthillToken && stored.anthillUser) {
    setSignedIn(stored.anthillUser)
  } else {
    setSignedOut()
  }
}

$('save-url-btn').addEventListener('click', async () => {
  const val = normalizeApiUrl($('api-url-input').value)
  if (!val) return
  await setStored({ apiUrl: val })
  $('api-url-input').value = val
  $('save-url-btn').textContent = 'Saved'
  setTimeout(() => { $('save-url-btn').textContent = 'Save' }, 1500)
})

$('open-signup').addEventListener('click', async (e) => {
  e.preventDefault()
  const apiUrl = await getApiUrl()
  chrome.tabs.create({ url: `${apiUrl}/signup` })
})

$('login-btn').addEventListener('click', async () => {
  const email = $('login-email').value.trim()
  const password = $('login-password').value
  if (!email || !password) {
    showAlert($('login-status'), 'Email and password required.', 'error')
    return
  }
  const apiUrl = await getApiUrl()
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
  const apiUrl = await getApiUrl()
  const tabUrl = await refreshTab()
  if (!tabUrl) {
    showAlert($('capture-status'), 'No active tab to capture.', 'error')
    return
  }
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
      body: JSON.stringify({ sourceUrl: tabUrl }),
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
