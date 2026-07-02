import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/auth'
import { normalizeEmail, normalizePhone } from '@/lib/contacts'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, userId: auth.userId },
  })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const data: Record<string, string | null> = {}

  for (const k of ['name', 'company', 'notes'] as const) {
    if (k in body) {
      const v = typeof body[k] === 'string' ? body[k].trim() : ''
      data[k] = v === '' ? null : v.slice(0, k === 'notes' ? 2000 : 200)
    }
  }
  if ('email' in body) {
    const email = body.email ? normalizeEmail(body.email) : null
    if (body.email && !email) return NextResponse.json({ error: 'email is not valid' }, { status: 400 })
    data.email = email
  }
  if ('phone' in body) {
    const phone = body.phone ? normalizePhone(body.phone) : null
    if (body.phone && !phone) return NextResponse.json({ error: 'phone is not valid' }, { status: 400 })
    data.phone = phone
  }

  // A contact must keep at least one way to reach them.
  const nextEmail = 'email' in data ? data.email : contact.email
  const nextPhone = 'phone' in data ? data.phone : contact.phone
  if (!nextEmail && !nextPhone) {
    return NextResponse.json({ error: 'contact needs an email or phone' }, { status: 400 })
  }

  try {
    const updated = await prisma.contact.update({ where: { id: contact.id }, data })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Another contact already uses that email or phone' }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, userId: auth.userId },
  })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.contact.delete({ where: { id: contact.id } })
  return NextResponse.json({ success: true })
}
