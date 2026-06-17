import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { verifySignInState, getSignInRedirectUri, exchangeCode, fetchGoogleProfile } from '@/lib/google-auth'

export const dynamic = 'force-dynamic'

// Google redirects here after the identity consent. No Bearer token is present
// (the user isn't signed in yet), so we trust the signed `state` for CSRF.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const sp = request.nextUrl.searchParams
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin))

  if (sp.get('error')) return fail('google_denied')
  const code = sp.get('code')
  const state = sp.get('state')
  if (!code || !state) return fail('google')

  try {
    const { origin: stateOrigin } = await verifySignInState(state)
    const tokens = await exchangeCode(code, getSignInRedirectUri(stateOrigin))
    const profile = await fetchGoogleProfile(tokens.accessToken)

    // Require a Google-verified email — this is what makes linking-by-email safe.
    if (!profile.email || !profile.emailVerified) return fail('google_unverified')

    // Find by Google id first, then by email (links Google to an existing
    // email/password account that owns the same verified email).
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: profile.sub }, { email: profile.email }] },
    })

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.sub, name: user.name ?? profile.name },
        })
      }
    } else {
      user = await prisma.user.create({
        data: { email: profile.email, googleId: profile.sub, name: profile.name },
      })
    }

    const token = await signToken(user.id)
    // Hand the JWT to the client via the URL fragment (never sent to servers or
    // in Referer); /complete stores it in localStorage and strips the hash.
    return NextResponse.redirect(new URL(`/complete#t=${token}`, origin))
  } catch (e) {
    console.error('Google sign-in callback failed:', e)
    return fail('google')
  }
}
