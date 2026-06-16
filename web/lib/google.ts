import { SignJWT, jwtVerify } from 'jose'

// Google OAuth 2.0 + Calendar v3 REST, hand-rolled with fetch (no googleapis
// dependency). Pure network/config — no DB access here (see lib/google-store.ts).

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '')

// Full calendar scope is required for two-way sync (read + write). openid+email
// let us label the connected account.
export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar'].join(' ')

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function requireClient(): { id: string; secret: string } {
  const id = process.env.GOOGLE_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET
  if (!id || !secret) throw new Error('Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)')
  return { id, secret }
}

// redirect_uri must be byte-identical between the auth request and token
// exchange, and registered in the Google console. Derived from the request
// origin unless GOOGLE_REDIRECT_URI overrides.
export function getRedirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/callback`
}

// ── OAuth state (short-lived, signed; carries who started the flow) ──────────
export async function signState(userId: string, origin: string): Promise<string> {
  return new SignJWT({ userId, origin, purpose: 'google-oauth' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret)
}

export async function verifyState(token: string): Promise<{ userId: string; origin: string }> {
  const { payload } = await jwtVerify(token, secret)
  if (payload.purpose !== 'google-oauth') throw new Error('Invalid state purpose')
  return { userId: payload.userId as string, origin: payload.origin as string }
}

export function buildAuthUrl(state: string, redirectUri: string): string {
  const { id } = requireClient()
  const p = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token even on re-connect
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_URL}?${p.toString()}`
}

// ── Token endpoints ─────────────────────────────────────────────────────────
export type GoogleTokens = { accessToken: string; refreshToken?: string; expiresIn: number; scope: string }

export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
  const { id, secret } = requireClient()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  const j = await res.json()
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in, scope: j.scope }
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { id, secret } = requireClient()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`)
  const j = await res.json()
  // A refresh response does not return a new refresh_token.
  return { accessToken: j.access_token, refreshToken, expiresIn: j.expires_in, scope: j.scope ?? '' }
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Userinfo failed: ${res.status}`)
  const j = await res.json()
  return j.email ?? 'unknown'
}

// ── Calendar REST (primary calendar) ────────────────────────────────────────
export type GoogleEvent = {
  id: string
  status?: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  updated?: string
}

export type GoogleEventInput = { title: string; start: Date; end: Date; allDay: boolean; notes: string | null }

// v1 always pushes timed events (dateTime) for simplicity; all-day round-trips
// are handled on the read side. timeZone is UTC since we store absolute instants.
function toGoogleBody(input: GoogleEventInput) {
  return {
    summary: input.title,
    description: input.notes ?? undefined,
    start: { dateTime: input.start.toISOString(), timeZone: 'UTC' },
    end: { dateTime: input.end.toISOString(), timeZone: 'UTC' },
  }
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

export async function listGoogleEvents(accessToken: string, timeMin: Date, timeMax: Date): Promise<GoogleEvent[]> {
  const items: GoogleEvent[] = []
  let pageToken: string | undefined
  do {
    const p = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      showDeleted: 'true', // surfaces status:'cancelled' so we can reconcile deletions
    })
    if (pageToken) p.set('pageToken', pageToken)
    const res = await fetch(`${CAL_BASE}?${p.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`List events failed: ${res.status} ${await res.text()}`)
    const j = await res.json()
    items.push(...((j.items as GoogleEvent[]) ?? []))
    pageToken = j.nextPageToken
  } while (pageToken)
  return items
}

export async function insertGoogleEvent(accessToken: string, input: GoogleEventInput): Promise<GoogleEvent> {
  const res = await fetch(CAL_BASE, { method: 'POST', headers: authHeaders(accessToken), body: JSON.stringify(toGoogleBody(input)) })
  if (!res.ok) throw new Error(`Insert event failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function patchGoogleEvent(accessToken: string, googleEventId: string, input: GoogleEventInput): Promise<GoogleEvent> {
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(googleEventId)}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(toGoogleBody(input)),
  })
  if (!res.ok) throw new Error(`Patch event failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function deleteGoogleEvent(accessToken: string, googleEventId: string): Promise<void> {
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(googleEventId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
  // 404/410 mean it's already gone on Google's side — treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Delete event failed: ${res.status} ${await res.text()}`)
  }
}

// Normalize a Google event into our field shape. Returns null for events we
// can't place (missing start/end).
export function parseGoogleEvent(g: GoogleEvent): { title: string; start: Date; end: Date; allDay: boolean; notes: string | null; updated: Date } | null {
  if (!g.start || !g.end) return null
  const allDay = !!g.start.date && !g.start.dateTime
  const startRaw = allDay ? `${g.start.date}T00:00:00Z` : g.start.dateTime
  const endRaw = allDay ? `${g.end.date}T00:00:00Z` : g.end.dateTime
  if (!startRaw || !endRaw) return null
  const start = new Date(startRaw)
  const end = new Date(endRaw)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null
  return {
    title: g.summary?.trim() || '(no title)',
    start,
    end,
    allDay,
    notes: g.description ?? null,
    updated: g.updated ? new Date(g.updated) : new Date(),
  }
}
