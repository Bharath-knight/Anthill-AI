import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const task = await prisma.task.findFirst({
    where: { id: params.id, userId: auth.userId },
  })
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
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const task = await prisma.task.findFirst({
    where: { id: params.id, userId: auth.userId },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.task.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
