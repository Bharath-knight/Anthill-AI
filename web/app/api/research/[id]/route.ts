import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const existing = await prisma.researchItem.findFirst({ where: { id: params.id, userId: auth.userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  // Move to a collection (null clears it). The target must belong to the caller.
  if ('collectionId' in body) {
    const cid = body.collectionId
    if (cid === null) {
      data.collectionId = null
    } else if (typeof cid === 'string') {
      const col = await prisma.collection.findFirst({ where: { id: cid, userId: auth.userId }, select: { id: true } })
      if (!col) return NextResponse.json({ error: 'collection not found' }, { status: 404 })
      data.collectionId = cid
    }
  }
  if (typeof body.title === 'string') data.title = body.title.trim() || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const updated = await prisma.researchItem.update({
    where: { id: params.id },
    data,
    include: { collection: { select: { id: true, name: true, color: true } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const existing = await prisma.researchItem.findFirst({ where: { id: params.id, userId: auth.userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.researchItem.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
