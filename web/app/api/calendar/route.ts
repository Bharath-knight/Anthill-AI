import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/auth'
import { deriveDeadlines, deriveUpcoming, buildSuggestions, type CalEvent } from '@/lib/google/calendar'
import { getValidAccessToken, pullAndReconcile } from '@/lib/google/google-store'

export const dynamic = 'force-dynamic'

// Read-side aggregate for the calendar page: the user's events in the visible
// range, plus deadline markers + suggestions derived from their tasks.
export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (auth instanceof Response) return auth

  const sp = request.nextUrl.searchParams
  const start = sp.get('start') ? new Date(sp.get('start') as string) : new Date()
  const end = sp.get('end') ? new Date(sp.get('end') as string) : new Date(start.getTime() + 7 * 86_400_000)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'invalid start/end' }, { status: 400 })
  }

  // Two-way sync (pull): reconcile Google events for this range into local rows
  // before reading, so Google-side changes show up. Non-fatal — if Google is
  // unreachable or the user isn't connected, we just render local events.
  try {
    const token = await getValidAccessToken(auth.userId)
    if (token) await pullAndReconcile(auth.userId, start, end, token)
  } catch (e) {
    console.error('Google pull failed (showing local events only):', e)
  }

  const [rows, tasks] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { userId: auth.userId, start: { lt: end }, end: { gt: start } },
      orderBy: { start: 'asc' },
    }),
    prisma.task.findMany({
      where: { userId: auth.userId },
      select: { id: true, title: true, deadline: true, completed: true, linkedJobId: true },
    }),
  ])

  const events: CalEvent[] = rows.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    allDay: e.allDay,
    type: e.type,
    notes: e.notes,
    source: e.source,
  }))

  const taskLikes = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    completed: t.completed,
    linkedJobId: t.linkedJobId,
    deadline: t.deadline ? t.deadline.toISOString() : null,
  }))

  const today = new Date()
  const deadlines = deriveDeadlines(taskLikes, start, end, today)
  const upcoming = deriveUpcoming(taskLikes, today)
  const suggestions = buildSuggestions(upcoming, today)

  return NextResponse.json({ events, deadlines, upcoming, suggestions })
}
