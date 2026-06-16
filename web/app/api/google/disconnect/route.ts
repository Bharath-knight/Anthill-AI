import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { disconnectGoogle } from '@/lib/google-store'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  await disconnectGoogle(auth.userId)
  return NextResponse.json({ ok: true })
}
