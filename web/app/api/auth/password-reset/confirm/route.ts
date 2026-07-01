import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { authCookieOptions, AUTH_COOKIE, signToken } from '@/lib/auth'
import { hashResetToken } from '@/lib/password-reset'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!token) {
    return NextResponse.json({ error: 'Reset token is required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const tokenHash = hashResetToken(token)
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
    return NextResponse.json({ error: 'This reset link is invalid or expired.' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: reset.userId },
      data: { password: hashed },
      select: { id: true, email: true, name: true, googleId: true },
    })
    await tx.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    })
    await tx.passwordResetToken.updateMany({
      where: { userId: reset.userId, usedAt: null, id: { not: reset.id } },
      data: { usedAt: new Date() },
    })
    return updated
  })

  const authToken = await signToken(user.id)
  const res = NextResponse.json({
    token: authToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      hasPassword: true,
      hasGoogle: Boolean(user.googleId),
    },
  })
  res.cookies.set(AUTH_COOKIE, authToken, authCookieOptions())
  return res
}
