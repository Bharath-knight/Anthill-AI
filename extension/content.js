// Anthill — floating "quick capture" popup (Rakuten-style).
//
// Runs on every page. Listens for copy/cut events; when the user copies *just* a
// URL, a small card slides in from the bottom-right with a preview and a one-tap
// "Add to Anthill" action. All UI lives inside a Shadow DOM so host-page CSS can
// never bleed in (or out). Network + auth go through the background worker.
//
// Known boundary: a content script can only observe in-page copies. Address-bar
// (omnibox) copies and copies made in other apps are not observable by any
// extension API — that's a browser limitation, not a bug here.

;(() => {
  if (window.__anthillQuickCapture) return
  window.__anthillQuickCapture = true

  const API_URL = 'https://anthill-ai.vercel.app'
  const HANDLED_KEY = 'anthillHandledUrls'
  const HANDLED_CAP = 500
  const AUTO_DISMISS_MS = 12000

  const URL_RE = /\bhttps?:\/\/[^\s<>"'`)\[\]]+/i
  // Trailing punctuation that commonly rides along with a copied URL.
  const TRAILING = /[.,;:!?)\]}>'"]+$/

  let currentHost = null // the live popup host element, or null when none is shown
  let autoTimer = null
  let dismissing = false // true during a card's exit animation, so no second card slips in

  // --- helpers ---------------------------------------------------------------

  function send(msg) {
    try {
      return chrome.runtime.sendMessage(msg).catch(() => null)
    } catch {
      // Extension reloaded/updated: context invalidated. Fail quietly.
      return Promise.resolve(null)
    }
  }

  function getHandled() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([HANDLED_KEY], (r) => resolve(Array.isArray(r?.[HANDLED_KEY]) ? r[HANDLED_KEY] : []))
      } catch {
        resolve([])
      }
    })
  }

  function markHandled(url) {
    getHandled().then((list) => {
      if (list.includes(url)) return
      const next = [...list, url].slice(-HANDLED_CAP)
      try {
        chrome.storage.local.set({ [HANDLED_KEY]: next })
      } catch {
        /* ignore */
      }
    })
  }

  // Strip the fragment so #section anchors don't count as distinct URLs.
  function normalize(raw) {
    try {
      const u = new URL(raw)
      u.hash = ''
      return u.toString()
    } catch {
      return raw
    }
  }

  function cleanUrl(raw) {
    let s = raw.trim().replace(TRAILING, '')
    return s
  }

  // Only surface the card for real, fetchable web pages.
  function capturable(u) {
    const host = u.hostname.toLowerCase()
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false
    if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(host)) return false // raw IPs (incl. private)
    if (host === 'anthill-ai.vercel.app') return false // our own app — nothing to capture
    return true
  }

  function sameAsCurrentPage(u) {
    try {
      const here = new URL(location.href)
      return here.origin === u.origin && here.pathname === u.pathname && here.search === u.search
    } catch {
      return false
    }
  }

  function shortUrl(u) {
    const path = (u.pathname + u.search).replace(/\/$/, '')
    const tail = path && path !== '/' ? path : ''
    const full = u.hostname + tail
    return full.length > 48 ? full.slice(0, 47) + '…' : full
  }

  // --- copy detection --------------------------------------------------------

  async function onCopy(e) {
    if (currentHost || dismissing) return // one card at a time; also dodges self-copy inside the card

    const text = (window.getSelection && String(window.getSelection())) || ''
    const trimmed = text.trim()
    if (!trimmed) return

    const m = trimmed.match(URL_RE)
    if (!m) return
    const urlStr = cleanUrl(m[0])

    // Require the selection to be *essentially just* the URL — copying a paragraph
    // that merely contains a link should not trigger the popup.
    if (trimmed.length > urlStr.length + 8) return

    let u
    try {
      u = new URL(urlStr)
    } catch {
      return
    }
    if (!capturable(u)) return

    const key = normalize(urlStr)
    const handled = await getHandled()
    if (handled.includes(key)) return

    // NB: we mark the URL handled on close (dismiss/add/timeout), not here — so a
    // network failure leaves the card retryable rather than burning the URL.
    show(u, urlStr, key)
  }

  // --- popup -----------------------------------------------------------------

  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .card {
      position: fixed;
      right: 20px;
      bottom: 20px;
      width: 344px;
      max-width: calc(100vw - 40px);
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      color: #16161b;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.07);
      border-radius: 16px;
      padding: 14px 14px 12px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.16);
      transform: translateY(16px) scale(0.98);
      opacity: 0;
      transition: transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease;
      will-change: transform, opacity;
    }
    .card.in { transform: translateY(0) scale(1); opacity: 1; }
    .card.out { transform: translateY(8px) scale(0.98); opacity: 0; }

    .close {
      position: absolute; top: 10px; right: 10px;
      width: 22px; height: 22px;
      display: grid; place-items: center;
      border: none; background: transparent; cursor: pointer;
      border-radius: 6px; color: #9a9aa6;
      transition: background 0.15s, color 0.15s;
    }
    .close:hover { background: rgba(0,0,0,0.05); color: #16161b; }
    .close svg { width: 13px; height: 13px; }

    .head { display: flex; align-items: flex-start; gap: 10px; padding-right: 22px; }
    .mascot { flex: 0 0 auto; width: 40px; height: 40px; animation: pop 460ms cubic-bezier(0.22, 1, 0.36, 1) both; }
    .mascot svg { width: 40px; height: 40px; display: block; }
    @keyframes pop { 0% { transform: scale(0.4) rotate(-8deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }

    .brand { min-width: 0; padding-top: 1px; }
    .brand-row { display: flex; align-items: center; gap: 6px; }
    .logo {
      width: 16px; height: 16px; border-radius: 4px;
      background: #b8e62e; color: #0e0e11;
      display: grid; place-items: center; font-weight: 800; font-size: 10px;
    }
    .brand-name { font-weight: 700; font-size: 13px; letter-spacing: -0.2px; }
    .tagline { color: #6b6b76; font-size: 11.5px; margin-top: 1px; }

    .preview {
      display: flex; align-items: center; gap: 10px;
      margin-top: 12px; padding: 9px 10px;
      background: #f6f6f8; border: 1px solid rgba(0,0,0,0.05);
      border-radius: 10px;
    }
    .fav { flex: 0 0 auto; width: 18px; height: 18px; border-radius: 4px; overflow: hidden; background: #e6e6ea; }
    .fav img { width: 18px; height: 18px; display: block; object-fit: cover; }
    .pmeta { min-width: 0; flex: 1; }
    .ptitle {
      font-weight: 600; font-size: 12.5px; color: #16161b;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .purl {
      font-size: 11px; color: #8a8a94;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .summary { margin-top: 10px; min-height: 32px; color: #44454f; font-size: 12.5px; }
    .summary .line { height: 9px; border-radius: 5px; margin: 4px 0;
      background: linear-gradient(90deg, #ececef 25%, #f6f6f8 37%, #ececef 63%);
      background-size: 400% 100%; animation: shimmer 1.4s ease infinite; }
    .summary .line.short { width: 62%; }
    @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
    .summary.muted { color: #8a8a94; }

    .actions { display: flex; gap: 8px; margin-top: 13px; }
    .btn {
      flex: 1; padding: 9px 12px; border-radius: 9px; border: none;
      font-size: 12.5px; font-weight: 600; cursor: pointer;
      font-family: inherit; transition: background 0.15s, opacity 0.15s, transform 0.08s;
    }
    .btn:active { transform: translateY(0.5px); }
    .btn.ghost { background: #f1f1f4; color: #44454f; flex: 0 0 auto; }
    .btn.ghost:hover { background: #e7e7ec; }
    .btn.primary { background: #b8e62e; color: #0e0e11; }
    .btn.primary:hover { background: #aedb24; }
    .btn:disabled { opacity: 0.6; cursor: default; }

    .done { display: flex; align-items: center; gap: 8px; margin-top: 13px; color: #16161b; font-weight: 600; font-size: 12.5px; }
    .done .check {
      width: 20px; height: 20px; border-radius: 50%; flex: 0 0 auto;
      background: #b8e62e; color: #0e0e11; display: grid; place-items: center;
      animation: pop 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .done .check svg { width: 11px; height: 11px; }
    .hidden { display: none !important; }

    @media (prefers-color-scheme: dark) {
      .card { color: #ececf1; background: #1a1a20; border-color: rgba(255,255,255,0.08);
        box-shadow: 0 1px 2px rgba(0,0,0,0.4), 0 16px 40px rgba(0,0,0,0.55); }
      .close { color: #76768a; } .close:hover { background: rgba(255,255,255,0.08); color: #ececf1; }
      .tagline { color: #9090a0; }
      .preview { background: #23232c; border-color: rgba(255,255,255,0.06); }
      .fav { background: #2e2e3a; }
      .ptitle { color: #ececf1; } .purl { color: #76768a; }
      .summary { color: #c2c2cc; } .summary.muted { color: #76768a; }
      .summary .line { background: linear-gradient(90deg, #2a2a33 25%, #34343f 37%, #2a2a33 63%); background-size: 400% 100%; }
      .btn.ghost { background: #2a2a33; color: #c2c2cc; } .btn.ghost:hover { background: #34343f; }
      .done { color: #ececf1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .card, .mascot, .done .check { transition: opacity 120ms linear; animation: none; }
      .card { transform: none; } .card.in { transform: none; } .card.out { transform: none; }
      .summary .line { animation: none; }
    }
  `

  // Friendly minimal ant mascot ("Ant") carrying a lime leaf — ties to the brand color.
  const ANT_SVG = `
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="#2a2a33" stroke-width="2.4" stroke-linecap="round">
        <path d="M30 34 L20 44"/><path d="M31 36 L24 49"/>
        <path d="M34 35 L44 45"/><path d="M33 37 L40 50"/>
        <path d="M22 30 L12 36"/><path d="M22 33 L14 42"/>
      </g>
      <ellipse cx="42" cy="34" rx="12" ry="10.5" fill="#2a2a33"/>
      <circle cx="29" cy="32" r="7" fill="#2a2a33"/>
      <circle cx="18" cy="28" r="8.5" fill="#2a2a33"/>
      <g stroke="#2a2a33" stroke-width="2.2" stroke-linecap="round" fill="none">
        <path d="M14 22 C10 15 12 11 9 9"/><path d="M21 21 C19 13 22 10 21 7"/>
      </g>
      <circle cx="9" cy="8" r="2.3" fill="#b8e62e"/><circle cx="21" cy="6.5" r="2.3" fill="#b8e62e"/>
      <circle cx="16" cy="27" r="2" fill="#fff"/><circle cx="21" cy="28" r="2" fill="#fff"/>
      <circle cx="16.4" cy="27.4" r="1" fill="#16161b"/><circle cx="21.4" cy="28.4" r="1" fill="#16161b"/>
      <path d="M51 24 C58 22 60 28 56 33 C52 31 50 28 51 24 Z" fill="#b8e62e"/>
      <path d="M53 25 C54 28 55 30 56 32" stroke="#0e0e11" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`

  const CLOSE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>`
  const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13 l4 4 L19 6"/></svg>`

  function clearAutoTimer() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null }
  }

  function startAutoTimer() {
    clearAutoTimer()
    autoTimer = setTimeout(() => dismiss(), AUTO_DISMISS_MS)
  }

  function dismiss() {
    clearAutoTimer()
    const host = currentHost
    currentHost = null
    if (!host) return
    // Closing for any reason (dismiss/add-success/timeout) settles this URL: it
    // won't pop again. Errors keep the card open, so they never reach here.
    if (host.__urlKey) markHandled(host.__urlKey)
    dismissing = true
    const card = host.__card
    if (card) {
      card.classList.remove('in')
      card.classList.add('out')
      setTimeout(() => { host.remove(); dismissing = false }, 320)
    } else {
      host.remove()
      dismissing = false
    }
  }

  function show(u, urlStr, key) {
    const host = document.createElement('div')
    host.id = 'anthill-quick-capture-host'
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;'
    const root = host.attachShadow({ mode: 'open' })

    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="card" role="dialog" aria-label="Add to Anthill">
        <button class="close" aria-label="Dismiss">${CLOSE_SVG}</button>
        <div class="head">
          <div class="mascot">${ANT_SVG}</div>
          <div class="brand">
            <div class="brand-row"><span class="logo">A</span><span class="brand-name">Anthill</span></div>
            <div class="tagline">Want me to file this away?</div>
          </div>
        </div>
        <div class="preview">
          <div class="fav"><img alt=""></div>
          <div class="pmeta">
            <div class="ptitle"></div>
            <div class="purl"></div>
          </div>
        </div>
        <div class="summary"><div class="line"></div><div class="line short"></div></div>
        <div class="actions">
          <button class="btn ghost dismiss">Dismiss</button>
          <button class="btn primary add">Add to Anthill</button>
        </div>
        <div class="done hidden"><span class="check">${CHECK_SVG}</span><span class="done-text"></span></div>
      </div>`

    const card = root.querySelector('.card')
    host.__card = card
    host.__urlKey = key
    document.documentElement.appendChild(host)
    currentHost = host

    const el = (sel) => root.querySelector(sel)
    const titleEl = el('.ptitle')
    const urlEl = el('.purl')
    const favEl = el('.fav img')
    const summaryEl = el('.summary')
    const addBtn = el('.add')
    const actionsEl = el('.actions')
    const doneEl = el('.done')
    const doneText = el('.done-text')

    // Optimistic content from the URL alone, so the card never looks empty.
    titleEl.textContent = u.hostname
    urlEl.textContent = shortUrl(u)
    favEl.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=64`
    favEl.addEventListener('error', () => { favEl.style.display = 'none' }, { once: true })

    // Animate in (next frame so the transition runs).
    requestAnimationFrame(() => card.classList.add('in'))
    startAutoTimer()

    // Keep it on screen while the user is reading/hovering.
    card.addEventListener('mouseenter', clearAutoTimer)
    card.addEventListener('mouseleave', startAutoTimer)

    el('.close').addEventListener('click', dismiss)
    el('.dismiss').addEventListener('click', dismiss)

    const includePageCtx = sameAsCurrentPage(u)
    const pageText = includePageCtx ? (document.body?.innerText || '').slice(0, 12000) : undefined
    const pageTitle = includePageCtx ? document.title : undefined

    function setSummary(text, muted) {
      summaryEl.classList.toggle('muted', Boolean(muted))
      summaryEl.textContent = text
    }

    // --- preview (lazy summary) ---
    send({ type: 'PREVIEW', url: urlStr, pageText, pageTitle }).then((res) => {
      if (currentHost !== host) return // dismissed already
      if (!res) {
        setSummary('Anthill was updated — reload the page to continue.', true)
        return
      }
      if (res.authed === false) {
        setSummary('Sign in to Anthill to save and summarize this page.', true)
        addBtn.textContent = 'Sign in'
        return
      }
      if (!res.ok || !res.data) {
        setSummary("Couldn't load a preview — you can still add it.", true)
        return
      }
      const d = res.data
      if (d.title) titleEl.textContent = d.title
      if (d.favicon) { favEl.style.display = 'block'; favEl.src = d.favicon }
      setSummary(d.summary || 'No summary available.', !d.summary)
    })

    // --- add to anthill ---
    addBtn.addEventListener('click', async () => {
      clearAutoTimer()
      if (addBtn.textContent === 'Sign in') {
        send({ type: 'OPEN_URL', url: `${API_URL}/login` })
        dismiss()
        return
      }
      addBtn.disabled = true
      addBtn.textContent = 'Adding…'
      const res = await send({ type: 'CAPTURE', url: urlStr, pageText, pageTitle })
      if (currentHost !== host) return

      if (!res) {
        addBtn.disabled = false
        addBtn.textContent = 'Retry'
        setSummary('Anthill was updated — reload the page and try again.', true)
        return
      }
      if (res.authed === false) {
        addBtn.disabled = false
        addBtn.textContent = 'Sign in'
        setSummary('Your session expired — sign in to Anthill to save.', true)
        return
      }
      if (!res.ok && res.status !== 409) {
        addBtn.disabled = false
        addBtn.textContent = 'Retry'
        setSummary(res.error === 'network' ? "Couldn't reach Anthill. Try again." : 'Something went wrong. Try again.', true)
        return
      }

      const t = res.data?.type
      const label = res.status === 409
        ? 'Already in your Anthill'
        : t === 'job'
          ? `Saved as job${res.data?.company ? ` · ${res.data.company}` : ''}`
          : 'Saved to Anthill'
      actionsEl.classList.add('hidden')
      summaryEl.classList.add('hidden')
      doneEl.classList.remove('hidden')
      doneText.textContent = label
      autoTimer = setTimeout(() => dismiss(), 2600)
    })
  }

  // --- wiring ----------------------------------------------------------------

  document.addEventListener('copy', onCopy, true)
  document.addEventListener('cut', onCopy, true)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentHost) dismiss()
  }, true)
})()
