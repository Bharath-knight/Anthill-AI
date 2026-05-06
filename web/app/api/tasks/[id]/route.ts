import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = process.env.DEV_USER_ID
  if (!userId) return NextResponse.json({ error: 'DEV_USER_ID not set' }, { status: 500 })

  const task = await prisma.task.findFirst({ where: { id: params.id, userId } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const allowed = ['completed', 'title', 'description', 'deadline'] as const
  const data: Record<string, unknown> = Object.fromEntries(
    allowed.filter(k => k in body).map(k => [k, body[k]])
  )
  if ('deadline' in body) {
    data.deadline = body.deadline ? new Date(body.deadline) : null
  }

  const updated = await prisma.task.update({ where: { id: params.id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = process.env.DEV_USER_ID
  if (!userId) return NextResponse.json({ error: 'DEV_USER_ID not set' }, { status: 500 })

  const task = await prisma.task.findFirst({ where: { id: params.id, userId } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.task.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}