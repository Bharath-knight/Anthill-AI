import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/auth'

// Layer 4: reclassify a misrouted research item as a job. Requires a source URL (the
// job's unique key). Mirrors capture's job creation — Unknown fields + an auto-task;
// the user fills in details via the edit modal afterward.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const item = await prisma.researchItem.findFirst({
    where: { id: params.id, userId: auth.userId },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!item.sourceUrl) {
    return NextResponse.json(
      { error: 'This research item has no source URL, so it cannot become a job.' },
      { status: 400 }
    )
  }

  const existing = await prisma.job.findUnique({
    where: { userId_link: { userId: auth.userId, link: item.sourceUrl } },
  })
  if (existing) {
    return NextResponse.json({ error: 'A job with this URL already exists.' }, { status: 409 })
  }

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.job.create({
      data: {
        userId: auth.userId,
        company: 'Unknown Company',
        role: 'Unknown Role',
        deadline: 'Deadline not given',
        link: item.sourceUrl!,
        rawText: item.content,
        status: 'SAVED',
      },
    })
    await tx.task.create({
      data: {
        userId: auth.userId,
        title: `Review & apply to ${created.role} at ${created.company}`,
        linkedJobId: created.id,
      },
    })
    await tx.researchItem.delete({ where: { id: item.id } })
    return created
  })

  return NextResponse.json({ type: 'job', ...job })
}
