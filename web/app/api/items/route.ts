import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const [jobs, research] = await Promise.all([
    prisma.job.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      include: { events: { orderBy: { createdAt: 'desc' } } },
    }),
    prisma.researchItem.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({ jobs, research })
}
