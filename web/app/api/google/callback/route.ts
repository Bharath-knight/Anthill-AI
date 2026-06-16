import { NextRequest, NextResponse } from 'next/server'
import { verifyState, exchangeCode, getRedirectUri } from '@/lib/google'
import { saveGoogleAccount } from '@/lib/google-store'

export const dynamic = 'force-dynamic'

// Google redirects here after consent. No Bearer token is present on a
// top-level navigation, so we trust the signed `state` to identify the user.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const redirect = (status: string) => NextResponse.redirect(new URL(`/calendar?google=${status}`, request.nextUrl.origin))

  if (sp.get('error')) return redirect('denied')

  const code = sp.get('code')
  const state = sp.get('state')
  if (!code || !state) return redirect('error')

  try {
    const { userId, origin } = await verifyState(state)
    // redirect_uri must match the one used to build the auth URL exactly.
    const tokens = await exchangeCode(code, getRedirectUri(origin))
    await saveGoogleAccount(userId, tokens, tokens.scope)
    return redirect('connected')
  } catch (e) {
    console.error('Google OAuth callback failed:', e)
    return redirect('error')
  }
}
