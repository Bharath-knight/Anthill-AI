const DEFAULT_API_URL = 'http://localhost:3000'

const btn = document.getElementById('capture-btn')
const statusEl = document.getElementById('status-msg')
const urlDisplay = document.getElementById('url-display')
const apiUrlInput = document.getElementById('api-url-input')
const saveUrlBtn = document.getElementById('save-url-btn')

function showStatus(msg, isError) {
  statusEl.textContent = msg
  statusEl.style.color = isError ? '#dc2626' : '#16a34a'
  statusEl.style.display = 'block'
}

chrome.storage.local.get(['apiUrl'], (result) => {
  const apiUrl = result.apiUrl || DEFAULT_API_URL
  apiUrlInput.value = apiUrl
})

saveUrlBtn.addEventListener('click', () => {
  const val = apiUrlInput.value.trim().replace(/\/$/, '')
  if (!val) return
  chrome.storage.local.set({ apiUrl: val }, () => {
    saveUrlBtn.textContent = 'Saved!'
    setTimeout(() => { saveUrlBtn.textContent = 'Save' }, 1500)
  })
})

chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const tabUrl = tabs[0]?.url || ''
  urlDisplay.textContent = tabUrl

  btn.addEventListener('click', async () => {
    btn.disabled = true
    btn.textContent = 'Saving...'
    statusEl.style.display = 'none'

    chrome.storage.local.get(['apiUrl'], async (result) => {
      const apiUrl = (result.apiUrl || DEFAULT_API_URL).replace(/\/$/, '')

      try {
        const res = await fetch(`${apiUrl}/api/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'job', sourceUrl: tabUrl }),
        })

        const data = await res.json()

        if (!res.ok) {
          showStatus(res.status === 409 ? 'Already saved.' : data.error || 'Failed to save.', true)
        } else {
          showStatus(`Saved: ${data.company} — ${data.role}`, false)
        }
      } catch {
        showStatus('Cannot connect to API. Is the server running?', true)
      } finally {
        btn.disabled = false
        btn.textContent = 'Capture This Job'
      }
    })
  })
})
