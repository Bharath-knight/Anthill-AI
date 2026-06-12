import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { deriveDeadlines, deriveUpcoming, buildSuggestions, type CalEvent } from '@/lib/calendar'

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
