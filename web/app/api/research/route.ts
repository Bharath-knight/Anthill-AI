import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const items = await prisma.researchItem.findMany({
    where: { userId: auth.userId },
    include: {
      matches: {
        include: { task: { select: { id: true, title: true } } },
        orderBy: { matchScore: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const { content, sourceUrl, domain } = await request.json()
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  let resolvedDomain = domain
  if (!resolvedDomain && sourceUrl) {
    try { resolvedDomain = new URL(sourceUrl).hostname } catch {}
  }

  const item = await prisma.researchItem.create({
    data: { userId: auth.userId, content, sourceUrl: sourceUrl || null, domain: resolvedDomain || null },
  })
  return NextResponse.json(item, { status: 201 })
}
