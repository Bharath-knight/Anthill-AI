import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authCookieOptions, AUTH_COOKIE, signToken } from '@/lib/auth'
import { verifySignInState, getSignInRedirectUri, exchangeCode, fetchGoogleProfile, SIGNIN_STATE_COOKIE } from '@/lib/google-auth'

export const dynamic = 'force-dynamic'

// Google redirects here after the identity consent. No Bearer token is present
// (the user isn't signed in yet), so we trust the signed `state` PLUS a per-browser
// nonce cookie (set in /start) to prevent login-CSRF / session fixation.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const sp = request.nextUrl.searchParams

  // Every exit clears the single-use state cookie.
  const redirect = (path: string, token?: string) => {
    const res = NextResponse.redirect(new URL(path, origin))
    res.cookies.set(SIGNIN_STATE_COOKIE, '', { path: '/', maxAge: 0 })
    if (token) res.cookies.set(AUTH_COOKIE, token, authCookieOptions())
    return res
  }
  const fail = (reason: string) => redirect(`/login?error=${reason}`)

  if (sp.get('error')) return fail('google_denied')
  const code = sp.get('code')
  const state = sp.get('state')
  if (!code || !state) return fail('google')

  try {
    const { origin: stateOrigin, nonce } = await verifySignInState(state)

    // The state's nonce must match the cookie set in this browser at /start.
    const cookieNonce = request.cookies.get(SIGNIN_STATE_COOKIE)?.value
    if (!cookieNonce || cookieNonce !== nonce) return fail('google')

    const tokens = await exchangeCode(code, getSignInRedirectUri(stateOrigin))
    const profile = await fetchGoogleProfile(tokens.accessToken)

    // A Google-verified email is what makes linking-by-email safe.
    if (!profile.email || !profile.emailVerified) return fail('google_unverified')

    // googleId is authoritative. Only link by (verified) email when the existing
    // row has no Google identity yet; never sign into an account whose googleId
    // differs from this caller's.
    let user = await prisma.user.findUnique({ where: { googleId: profile.sub } })
    if (!user) {
      // Case-insensitive: Google reports lowercase emails, but a password account
      // created with mixed case must link rather than fork a duplicate account.
      const byEmail = await prisma.user.findFirst({
        where: { email: { equals: profile.email, mode: 'insensitive' } },
      })
      if (byEmail) {
        if (byEmail.googleId && byEmail.googleId !== profile.sub) return fail('google')
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: profile.sub, name: byEmail.name ?? profile.name },
        })
      } else {
        user = await prisma.user.create({
          data: { email: profile.email, googleId: profile.sub, name: profile.name },
        })
      }
    }

    const token = await signToken(user.id)
    const setupPassword = user.password ? '' : '&setupPassword=1'
    // Hand the JWT to the client via the URL fragment (never sent to servers or
    // in Referer); /complete stores it in localStorage and strips the hash.
    return redirect(`/complete#t=${encodeURIComponent(token)}${setupPassword}`, token)
  } catch (e) {
    console.error('Google sign-in callback failed:', e)
    return fail('google')
  }
}
