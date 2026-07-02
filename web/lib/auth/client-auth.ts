const TOKEN_KEY = 'anthill_token'
const USER_KEY = 'anthill_user'
const AUTH_COOKIE = 'anthill_token'
const THIRTY_DAYS = 60 * 60 * 24 * 30

type SessionUser = {
  id: string
  email: string
  name?: string | null
  hasPassword?: boolean
  hasGoogle?: boolean
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(value: string) {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${THIRTY_DAYS}; SameSite=Lax${secure}`
}

function clearCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

function postExtensionAuth(token: string | null, user: SessionUser | null) {
  if (typeof window === 'undefined') return
  window.postMessage(
    { source: 'anthill-web', type: 'ANTHILL_AUTH_SYNC', token, user },
    window.location.origin
  )
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY) || readCookie(AUTH_COOKIE)
}

export function getStoredUser(): SessionUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function updateStoredUser(patch: Partial<SessionUser>): SessionUser | null {
  if (typeof window === 'undefined') return null
  const current = getStoredUser()
  if (!current) return null
  const next = { ...current, ...patch }
  localStorage.setItem(USER_KEY, JSON.stringify(next))
  const token = getToken()
  if (token) postExtensionAuth(token, next)
  return next
}

export function persistSession(token: string, user: SessionUser) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  writeCookie(token)
  postExtensionAuth(token, user)
}

export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  clearCookie()
  postExtensionAuth(null, null)
}

export async function bootstrapSession(): Promise<SessionUser | null> {
  const token = getToken()
  if (!token || typeof window === 'undefined') return null

  localStorage.setItem(TOKEN_KEY, token)

  const stored = getStoredUser()
  if (stored && typeof stored.hasPassword === 'boolean') {
    postExtensionAuth(token, stored)
    return stored
  }

  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null)

  if (!res?.ok) return null

  const user = (await res.json()) as SessionUser
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  postExtensionAuth(token, user)
  return user
}
