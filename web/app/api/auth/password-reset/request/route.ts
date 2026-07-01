import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildResetUrl, createResetToken, RESET_TTL_MINUTES, sendPasswordResetEmail } from '@/lib/password-reset'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const emailConfigured = Boolean(process.env.RESEND_API_KEY && (process.env.PASSWORD_RESET_FROM || process.env.EMAIL_FROM))
  if (!emailConfigured && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Password reset email is not configured.' }, { status: 503 })
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })

  if (!user) {
    return NextResponse.json({ ok: true })
  }

  const { token, tokenHash } = createResetToken()
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000)

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  })

  const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const resetUrl = buildResetUrl(origin, token)
  const delivery = await sendPasswordResetEmail(user.email, resetUrl)

  if (!delivery.sent && process.env.NODE_ENV === 'production') {
    console.error('Password reset email failed:', delivery.reason)
    return NextResponse.json({ error: 'Password reset email is not configured.' }, { status: 503 })
  }

  return NextResponse.json({
    ok: true,
    ...(delivery.sent ? {} : { resetUrl }),
  })
}
