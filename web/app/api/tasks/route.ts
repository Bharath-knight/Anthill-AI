import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const tasks = await prisma.task.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    include: { linkedJob: { select: { id: true, company: true, role: true } } },
  })
  return NextResponse.json(tasks)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const { title, description, deadline, linkedJobId } = await request.json()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  if (linkedJobId) {
    const job = await prisma.job.findFirst({
      where: { id: linkedJobId, userId: auth.userId },
      select: { id: true },
    })
    if (!job) {
      return NextResponse.json({ error: 'linkedJobId not found' }, { status: 404 })
    }
  }

  const task = await prisma.task.create({
    data: {
      userId: auth.userId,
      title,
      description: description || null,
      deadline: deadline ? new Date(deadline) : null,
      linkedJobId: linkedJobId || null,
    },
    include: { linkedJob: { select: { id: true, company: true, role: true } } },
  })
  return NextResponse.json(task, { status: 201 })
}
