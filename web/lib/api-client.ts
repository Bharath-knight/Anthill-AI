export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('anthill_token')
}

export function clearAuth() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('anthill_token')
  localStorage.removeItem('anthill_user')
}

export async function authedFetch(
  input: RequestInfo,
  init: RequestInit = {}
): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(input, { ...init, headers })
  if (res.status === 401 && typeof window !== 'undefined') {
    clearAuth()
    window.location.href = '/login'
  }
  return res
}
