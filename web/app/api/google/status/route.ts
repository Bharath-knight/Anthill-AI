import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/auth'
import { getConnection } from '@/lib/google/google-store'
import { googleConfigured } from '@/lib/google/google'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const conn = await getConnection(auth.userId)
  return NextResponse.json({ ...conn, configured: googleConfigured() })
}
