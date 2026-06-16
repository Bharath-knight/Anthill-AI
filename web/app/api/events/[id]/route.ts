import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { EVENT_TYPES } from '@/lib/calendar'
import { pushUpdate, pushDelete } from '@/lib/google-store'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const existing = await prisma.calendarEvent.findFirst({
    where: { id: params.id, userId: auth.userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (body.start) {
    const s = new Date(body.start)
    if (!isNaN(s.getTime())) data.start = s
  }
  if (body.end) {
    const e = new Date(body.end)
    if (!isNaN(e.getTime())) data.end = e
  }
  if (typeof body.allDay === 'boolean') data.allDay = body.allDay
  if (EVENT_TYPES.includes(body.type)) data.type = body.type
  if ('notes' in body) data.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

  const start = (data.start as Date) ?? existing.start
  const end = (data.end as Date) ?? existing.end
  if (end <= start) return NextResponse.json({ error: 'end must be after start' }, { status: 400 })

  const event = await prisma.calendarEvent.update({ where: { id: params.id }, data })

  // Mirror the edit to Google if connected (non-fatal).
  try {
    await pushUpdate(auth.userId, event)
  } catch (err) {
    console.error('Google push (update) failed:', err)
  }

  return NextResponse.json({
    id: event.id,
    title: event.title,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    allDay: event.allDay,
    type: event.type,
    notes: event.notes,
  })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const existing = await prisma.calendarEvent.findFirst({
    where: { id: params.id, userId: auth.userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.calendarEvent.delete({ where: { id: params.id } })

  // Mirror the deletion to Google if this event was synced (non-fatal).
  try {
    await pushDelete(auth.userId, existing.googleEventId)
  } catch (err) {
    console.error('Google push (delete) failed:', err)
  }

  return NextResponse.json({ ok: true })
}
