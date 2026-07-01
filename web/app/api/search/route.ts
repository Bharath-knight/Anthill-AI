import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

const LIMIT = 6

function containsAny(q: string, fields: string[]) {
  return {
    OR: fields.map((field) => ({
      [field]: { contains: q, mode: 'insensitive' as const },
    })),
  }
}

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ jobs: [], tasks: [], research: [] })
  }

  const [jobs, tasks, research] = await Promise.all([
    prisma.job.findMany({
      where: {
        userId: auth.userId,
        ...containsAny(q, ['company', 'role', 'location', 'deadline', 'link', 'notes']),
      },
      select: { id: true, company: true, role: true, link: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: LIMIT,
    }),
    prisma.task.findMany({
      where: {
        userId: auth.userId,
        ...containsAny(q, ['title', 'description']),
      },
      select: {
        id: true,
        title: true,
        completed: true,
        linkedJob: { select: { id: true, company: true, role: true, link: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: LIMIT,
    }),
    prisma.researchItem.findMany({
      where: {
        userId: auth.userId,
        ...containsAny(q, ['content', 'sourceUrl', 'domain']),
      },
      select: { id: true, content: true, domain: true, sourceUrl: true },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    }),
  ])

  return NextResponse.json({ jobs, tasks, research })
}
