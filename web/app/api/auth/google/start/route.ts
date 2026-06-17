import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { googleConfigured } from '@/lib/google'
import { signSignInState, buildSignInUrl, getSignInRedirectUri, SIGNIN_STATE_COOKIE } from '@/lib/google-auth'

export const dynamic = 'force-dynamic'

// Kicks off "Sign in with Google". A plain top-level GET (the login/signup
// button links here) → 302 to Google's consent for identity scopes only.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/login?error=google_unconfigured', origin))
  }

  // Bind the OAuth state to THIS browser: a random nonce lives both in the signed
  // state and in an HttpOnly cookie, so a captured code+state is useless in any
  // other browser (blocks login-CSRF / session fixation).
  const nonce = randomUUID()
  const state = await signSignInState(origin, nonce)
  const url = buildSignInUrl(state, getSignInRedirectUri(origin))

  const res = NextResponse.redirect(url)
  res.cookies.set(SIGNIN_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // allow http on localhost dev
    sameSite: 'lax', // sent on the top-level GET redirect back from Google
    path: '/',
    maxAge: 900, // matches the 15m state expiry
  })
  return res
}
