import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { authCookieOptions, AUTH_COOKIE, signToken } from '@/lib/auth/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }
    // Case-insensitive: legacy rows store the email as typed at signup, so a
    // user retyping their email in different case must still match.
    const user = await prisma.user.findFirst({
      where: { email: { equals: String(email).trim(), mode: 'insensitive' } },
    })
    // user.password is null for Google-only accounts — reject password login for them.
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    if (!user.password) {
      return NextResponse.json({
        error: 'This account uses Google sign-in. Continue with Google or reset your password to add one.',
      }, { status: 401 })
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const token = await signToken(user.id)
    const res = NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        hasPassword: true,
        hasGoogle: Boolean(user.googleId),
      },
    })
    res.cookies.set(AUTH_COOKIE, token, authCookieOptions())
    return res
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
