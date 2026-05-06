import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = process.env.DEV_USER_ID
  if (!userId) return NextResponse.json({ error: 'DEV_USER_ID not set' }, { status: 500 })

  const job = await prisma.job.findFirst({ where: { id: params.id, userId } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const allowed = ['status', 'company', 'role', 'location', 'deadline', 'notes'] as const
  const data = Object.fromEntries(
    allowed.filter(k => k in body).map(k => [k, body[k]])
  )

  const ops = [
    prisma.job.update({ where: { id: params.id }, data }),
    ...(body.status && body.status !== job.status
      ? [prisma.jobEvent.create({
          data: { jobId: params.id, type: 'STATUS_CHANGE', fromStatus: job.status, toStatus: body.status },
        })]
      : []),
  ]

  const [updated] = await prisma.$transaction(ops)
  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = process.env.DEV_USER_ID
  if (!userId) return NextResponse.json({ error: 'DEV_USER_ID not set' }, { status: 500 })

  const job = await prisma.job.findFirst({ where: { id: params.id, userId } })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.job.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
