import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/auth'
import { EVENT_TYPES, type EventType } from '@/lib/google/calendar'
import { pushCreate } from '@/lib/google/google-store'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const body = await request.json().catch(() => ({}))
  const { title, start, end, allDay, type, notes } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 })
  }
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    return NextResponse.json({ error: 'invalid start/end' }, { status: 400 })
  }
  if (e <= s) {
    return NextResponse.json({ error: 'end must be after start' }, { status: 400 })
  }
  const evType: EventType = EVENT_TYPES.includes(type) ? type : 'PERSONAL'

  const event = await prisma.calendarEvent.create({
    data: {
      userId: auth.userId,
      title: title.trim(),
      start: s,
      end: e,
      allDay: !!allDay,
      type: evType,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
    },
  })

  // Mirror to Google if connected (non-fatal — the local event is already saved).
  try {
    await pushCreate(auth.userId, event)
  } catch (err) {
    console.error('Google push (create) failed:', err)
  }

  return NextResponse.json(
    {
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      allDay: event.allDay,
      type: event.type,
      notes: event.notes,
    },
    { status: 201 }
  )
}
