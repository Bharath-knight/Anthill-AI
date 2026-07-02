import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const existing = await prisma.collection.findFirst({ where: { id: params.id, userId: auth.userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const data: { name?: string; color?: string | null } = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 60)
  if ('color' in body) data.color = typeof body.color === 'string' && body.color.trim() ? body.color.trim() : null

  if (data.name && data.name !== existing.name) {
    const clash = await prisma.collection.findFirst({ where: { userId: auth.userId, name: data.name } })
    if (clash) return NextResponse.json({ error: 'A collection with that name already exists' }, { status: 409 })
  }

  const updated = await prisma.collection.update({ where: { id: params.id }, data })
  return NextResponse.json({ id: updated.id, name: updated.name, color: updated.color })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const existing = await prisma.collection.findFirst({ where: { id: params.id, userId: auth.userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Items are kept; their collectionId nulls automatically (onDelete: SetNull).
  await prisma.collection.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
