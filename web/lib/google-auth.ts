import { SignJWT, jwtVerify } from 'jose'
import { exchangeCode } from './google'

// "Sign in with Google" — identity only (openid/email/profile). These are
// non-sensitive scopes, so this flow needs no Google app verification and works
// for managed/.edu accounts. Calendar access is a SEPARATE, sensitive-scope flow
// (lib/google.ts) intentionally kept decoupled so a blocked calendar scope can
// never block sign-in.

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '')

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

export const SIGNIN_SCOPES = ['openid', 'email', 'profile'].join(' ')

// Separate redirect URI from the calendar flow; must be registered in the
// Google console as an Authorized redirect URI (localhost + prod).
export function getSignInRedirectUri(origin: string): string {
  return process.env.GOOGLE_SIGNIN_REDIRECT_URI || `${origin}/api/auth/google/callback`
}

// CSRF-protective state: short-lived, signed, carries the origin so the callback
// reconstructs the exact redirect_uri used to start the flow.
export async function signSignInState(origin: string): Promise<string> {
  return new SignJWT({ origin, purpose: 'google-signin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret)
}

export async function verifySignInState(token: string): Promise<{ origin: string }> {
  const { payload } = await jwtVerify(token, secret)
  if (payload.purpose !== 'google-signin') throw new Error('Invalid state purpose')
  return { origin: payload.origin as string }
}

export function buildSignInUrl(state: string, redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('Google Sign-In not configured (GOOGLE_CLIENT_ID)')
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SIGNIN_SCOPES,
    access_type: 'online', // identity only — no refresh token needed
    prompt: 'select_account',
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_URL}?${p.toString()}`
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string | null }

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Userinfo failed: ${res.status}`)
  const j = await res.json()
  // v2 userinfo: `id` is the stable account id (the OIDC `sub`).
  return { sub: j.id, email: j.email, emailVerified: !!j.verified_email, name: j.name ?? null }
}

// Re-export so the callback route has one import surface for the OAuth pieces.
export { exchangeCode }
