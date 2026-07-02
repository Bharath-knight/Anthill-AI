import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/auth'

// Layer 4: reclassify a misrouted job as research. Creates a ResearchItem from the
// job's stored content, then removes the job and its auto-created tasks — all in one
// transaction. A missing/other-user job returns 404 (no existence leak).
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const job = await prisma.job.findFirst({
    where: { id: params.id, userId: auth.userId },
  })
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let domain: string | null = null
  try { domain = new URL(job.link).hostname } catch {}

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.researchItem.create({
      data: {
        userId: auth.userId,
        content: job.rawText || `${job.role} at ${job.company}`,
        sourceUrl: job.link,
        domain,
      },
    })
    await tx.task.deleteMany({ where: { userId: auth.userId, linkedJobId: job.id } })
    await tx.job.delete({ where: { id: job.id } })
    return created
  })

  return NextResponse.json({ type: 'research', ...item })
}
