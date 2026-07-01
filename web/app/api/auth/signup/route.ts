import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { authCookieOptions, AUTH_COOKIE, signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, password: hashed, name: name || null },
      select: { id: true, email: true, name: true, googleId: true },
    })
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
    }, { status: 201 })
    res.cookies.set(AUTH_COOKIE, token, authCookieOptions())
    return res
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
