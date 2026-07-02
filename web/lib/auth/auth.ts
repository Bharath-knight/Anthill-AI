import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
export const AUTH_COOKIE = 'anthill_token'
const THIRTY_DAYS = 60 * 60 * 24 * 30

export function authCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: THIRTY_DAYS,
  }
}

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ userId, purpose: 'auth' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, secret)
  // Other JWTs share JWT_SECRET (Google OAuth state tokens carry their own
  // `purpose`); only session tokens may authenticate. Tokens issued before the
  // purpose claim existed have no `purpose`, so absence is still accepted.
  if (payload.purpose !== undefined && payload.purpose !== 'auth') {
    throw new Error('Wrong token type')
  }
  if (typeof payload.userId !== 'string' || !payload.userId) {
    throw new Error('Token has no userId')
  }
  return { userId: payload.userId }
}

export async function getAuthUser(
  request: NextRequest
): Promise<{ userId: string } | Response> {
  const header = request.headers.get('authorization')
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null
  const cookie = request.cookies.get(AUTH_COOKIE)?.value ?? null
  const token = bearer || cookie
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    return await verifyToken(token)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
