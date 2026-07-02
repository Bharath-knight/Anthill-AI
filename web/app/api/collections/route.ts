import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// User-defined folders for research items. Every response is scoped to the caller.

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const collections = await prisma.collection.findMany({
    where: { userId: auth.userId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { items: true } } },
  })
  return NextResponse.json(
    collections.map((c) => ({ id: c.id, name: c.name, color: c.color, count: c._count.items }))
  )
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const color = typeof body.color === 'string' && body.color.trim() ? body.color.trim() : null
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (name.length > 60) return NextResponse.json({ error: 'name too long' }, { status: 400 })

  const existing = await prisma.collection.findFirst({ where: { userId: auth.userId, name } })
  if (existing) return NextResponse.json({ error: 'A collection with that name already exists' }, { status: 409 })

  const collection = await prisma.collection.create({ data: { userId: auth.userId, name, color } })
  return NextResponse.json({ id: collection.id, name: collection.name, color: collection.color, count: 0 }, { status: 201 })
}
