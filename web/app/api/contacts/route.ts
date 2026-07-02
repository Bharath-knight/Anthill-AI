import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/auth'
import { normalizeContactInput } from '@/lib/contacts'

// CORS so the extension's background worker can save contacts, mirroring /api/capture.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const contacts = await prisma.contact.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(contacts, { headers: CORS })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) {
    const body = await auth.text()
    return new NextResponse(body, { status: auth.status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = normalizeContactInput(body)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: CORS })
  }

  // Re-saving the same email/phone returns the existing contact as a 409 so the
  // extension can show "already in your contacts" instead of a failure.
  const existing = await prisma.contact.findFirst({
    where: {
      userId: auth.userId,
      OR: [
        ...(parsed.email ? [{ email: parsed.email }] : []),
        ...(parsed.phone ? [{ phone: parsed.phone }] : []),
      ],
    },
  })
  if (existing) {
    return NextResponse.json({ error: 'Contact already saved', contact: existing }, { status: 409, headers: CORS })
  }

  const contact = await prisma.contact.create({
    data: { userId: auth.userId, ...parsed },
  })
  return NextResponse.json(contact, { status: 201, headers: CORS })
}
