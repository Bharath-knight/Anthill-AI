import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = process.env.DEV_USER_ID
  if (!userId) return NextResponse.json({ error: 'DEV_USER_ID not set' }, { status: 500 })

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { linkedJob: { select: { id: true, company: true, role: true } } },
  })
  return NextResponse.json(tasks)
}

export async function POST(request: NextRequest) {
  const userId = process.env.DEV_USER_ID
  if (!userId) return NextResponse.json({ error: 'DEV_USER_ID not set' }, { status: 500 })

  const { title, description, deadline, linkedJobId } = await request.json()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const task = await prisma.task.create({
    data: {
      userId,
      title,
      description: description || null,
      deadline: deadline ? new Date(deadline) : null,
      linkedJobId: linkedJobId || null,
    },
    include: { linkedJob: { select: { id: true, company: true, role: true } } },
  })
  return NextResponse.json(task, { status: 201 })
}
