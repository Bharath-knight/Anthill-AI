import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/auth'
import { computeMatch } from '@/lib/capture/matcher'

const THRESHOLD = 0.05

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const [research, tasks] = await Promise.all([
    prisma.researchItem.findMany({ where: { userId: auth.userId } }),
    prisma.task.findMany({ where: { userId: auth.userId } }),
  ])

  const upserts = []
  for (const item of research) {
    for (const task of tasks) {
      const { score, keywords } = computeMatch(item.content, task.title, task.description)
      if (score >= THRESHOLD) {
        upserts.push(
          prisma.match.upsert({
            where: { researchItemId_taskId: { researchItemId: item.id, taskId: task.id } },
            create: { researchItemId: item.id, taskId: task.id, matchScore: score, matchedKeywords: keywords },
            update: { matchScore: score, matchedKeywords: keywords },
          })
        )
      }
    }
  }

  const matches = await prisma.$transaction(upserts)
  return NextResponse.json({ matched: matches.length })
}
