import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const { status } = await request.json()
  if (!['ACCEPTED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'status must be ACCEPTED or REJECTED' }, { status: 400 })
  }

  const match = await prisma.match.findFirst({
    where: { id: params.id, researchItem: { userId: auth.userId } },
  })
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.match.update({ where: { id: params.id }, data: { status } })
  return NextResponse.json(updated)
}
