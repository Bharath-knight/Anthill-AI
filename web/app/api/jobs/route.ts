import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { JobStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(request.url)
  const company = searchParams.get('company')
  const location = searchParams.get('location')
  const status = searchParams.get('status') as JobStatus | null

  const jobs = await prisma.job.findMany({
    where: {
      userId: auth.userId,
      ...(company && { company: { contains: company, mode: 'insensitive' } }),
      ...(location && { location: { contains: location, mode: 'insensitive' } }),
      ...(status && { status }),
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(jobs)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const { company, role, location, deadline, link, rawText, status } = await request.json()
  if (!company || !role || !link) {
    return NextResponse.json({ error: 'company, role, and link are required' }, { status: 400 })
  }

  try {
    const job = await prisma.job.create({
      data: {
        userId: auth.userId,
        company,
        role,
        location: location || null,
        deadline: deadline || 'Deadline not given',
        link,
        rawText: rawText || '',
        status: status || 'SAVED',
      },
    })
    // Every job gets a linked task (mirrors the capture flow).
    await prisma.task.create({
      data: {
        userId: auth.userId,
        title: `Review & apply to ${job.role} at ${job.company}`,
        linkedJobId: job.id,
      },
    })
    return NextResponse.json(job, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Job with this link already saved' }, { status: 409 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
