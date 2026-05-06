import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = process.env.DEV_USER_ID
  if (!userId) {
    return NextResponse.json({ error: 'DEV_USER_ID not set in .env.local' }, { status: 500 })
  }

  const [jobs, research] = await Promise.all([
    prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { events: { orderBy: { createdAt: 'desc' } } },
    }),
    prisma.researchItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ])

  return NextResponse.json({ jobs, research })
}
