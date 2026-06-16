import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { googleConfigured, getRedirectUri, signState, buildAuthUrl } from '@/lib/google'

export const dynamic = 'force-dynamic'

// Returns the Google consent URL for the authenticated user. The client (which
// holds the Bearer token) calls this, then navigates the browser to `url`.
// The signed `state` lets the callback recover the user without a token.
export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  if (!googleConfigured()) {
    return NextResponse.json({ error: 'Google Calendar is not configured on the server.' }, { status: 503 })
  }

  const origin = request.nextUrl.origin
  const state = await signState(auth.userId, origin)
  const url = buildAuthUrl(state, getRedirectUri(origin))
  return NextResponse.json({ url })
}
