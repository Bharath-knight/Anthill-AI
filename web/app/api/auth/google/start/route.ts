import { NextRequest, NextResponse } from 'next/server'
import { googleConfigured } from '@/lib/google'
import { signSignInState, buildSignInUrl, getSignInRedirectUri } from '@/lib/google-auth'

export const dynamic = 'force-dynamic'

// Kicks off "Sign in with Google". A plain top-level GET (the login/signup
// button links here) → 302 to Google's consent for identity scopes only.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/login?error=google_unconfigured', origin))
  }
  const state = await signSignInState(origin)
  const url = buildSignInUrl(state, getSignInRedirectUri(origin))
  return NextResponse.redirect(url)
}
