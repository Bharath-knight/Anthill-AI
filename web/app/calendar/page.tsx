'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { CalendarHeader } from '@/components/calendar/CalendarHeader'
import { WeekView } from '@/components/calendar/WeekView'
import { MonthView } from '@/components/calendar/MonthView'
import { AgendaView } from '@/components/calendar/AgendaView'
import { ContextPanel } from '@/components/calendar/ContextPanel'
import { EventEditor, type EventDraft } from '@/components/calendar/EventEditor'
import { useToast } from '@/components/Toast'
import { authedFetch, getToken } from '@/lib/api-client'
import {
  fetchRange, startOfWeek, weekDays, startOfDay, addDays, addMonths, ymd,
  type CalendarData, type CalendarView, type CalEvent, type Deadline, type Suggestion, type EventType,
} from '@/lib/calendar'

const pad2 = (n: number) => String(n).padStart(2, '0')
const timeFromISO = (iso: string) => { const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }

function newDraft(day: Date, hour = 9, type: EventType = 'FOCUS'): EventDraft {
  return {
    title: '', type, date: ymd(day),
    startTime: `${pad2(hour)}:00`, endTime: `${pad2(Math.min(hour + 1, 23))}:00`,
    allDay: false, notes: '',
  }
}
function editDraft(ev: CalEvent): EventDraft {
  return {
    id: ev.id, title: ev.title, type: ev.type, date: ymd(new Date(ev.start)),
    startTime: timeFromISO(ev.start), endTime: timeFromISO(ev.end),
    allDay: ev.allDay, notes: ev.notes ?? '',
  }
}
function draftToPayload(d: EventDraft) {
  const base = { title: d.title.trim(), type: d.type, notes: d.notes.trim() || null }
  if (d.allDay) {
    return { ...base, allDay: true, start: new Date(`${d.date}T00:00`).toISOString(), end: new Date(`${d.date}T23:59`).toISOString() }
  }
  return { ...base, allDay: false, start: new Date(`${d.date}T${d.startTime}`).toISOString(), end: new Date(`${d.date}T${d.endTime}`).toISOString() }
}

export default function CalendarPage() {
  const router = useRouter()
  const toast = useToast()
  const [authed, setAuthed] = useState(false)
  const [view, setView] = useState<CalendarView>('week')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<EventDraft | null>(null)

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return }
    setAuthed(true)
  }, [router])

  const reload = useCallback(() => {
    const { start, end } = fetchRange(view, anchor)
    return authedFetch(`/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then((r) => r.json())
      .then((d) => { if (d && !d.error) setData(d) })
      .catch(() => {})
  }, [view, anchor])

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, [authed, reload])

  function shift(dir: 1 | -1) {
    setAnchor((a) => (view === 'month' ? addMonths(a, dir) : view === 'agenda' ? addDays(a, dir * 30) : addDays(a, dir * 7)))
  }

  function openNew(day: Date, hour?: number) {
    setDraft(newDraft(day, hour))
    setEditorOpen(true)
  }
  function openEvent(ev: CalEvent) {
    setDraft(editDraft(ev))
    setEditorOpen(true)
  }
  function openDeadline(_d: Deadline) {
    router.push('/tasks') // deadlines are derived from tasks — manage them there
  }
  function onSuggestion(s: Suggestion) {
    const day = addDays(new Date(), 1)
    setDraft({
      title: s.kind === 'prep' ? 'Prep time' : 'Deep work',
      type: 'FOCUS', date: ymd(day), startTime: '09:00', endTime: '11:00', allDay: false, notes: '',
    })
    setEditorOpen(true)
  }

  async function onSave(d: EventDraft) {
    if (!d.allDay && d.endTime <= d.startTime) { toast.error('End must be after start'); return }
    const res = await authedFetch(d.id ? `/api/events/${d.id}` : '/api/events', {
      method: d.id ? 'PATCH' : 'POST',
      body: JSON.stringify(draftToPayload(d)),
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to save event'); return }
    setEditorOpen(false); setDraft(null)
    await reload()
    toast.success(d.id ? 'Event updated' : 'Event added')
  }
  async function onDelete(id: string) {
    const res = await authedFetch(`/api/events/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete event'); return }
    setEditorOpen(false); setDraft(null)
    await reload()
    toast.success('Event deleted')
  }

  function label(): string {
    if (view === 'month') return anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    if (view === 'agenda') return 'Next 30 days'
    const ds = weekDays(startOfWeek(anchor))
    const a = ds[0], b = ds[6]
    if (a.getMonth() === b.getMonth()) return a.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    return `${a.toLocaleDateString(undefined, { month: 'short' })} – ${b.toLocaleDateString(undefined, { month: 'short' })} ${b.getFullYear()}`
  }

  if (!authed) return null

  const events = data?.events ?? []
  const deadlines = data?.deadlines ?? []
  const upcoming = data?.upcoming ?? []
  const suggestions = data?.suggestions ?? []

  return (
    <AppShell fullBleed>
      <div className="flex">
        <div className="flex-1 min-w-0 px-4 sm:px-6 py-5">
          <CalendarHeader
            view={view}
            label={label()}
            onView={setView}
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
            onToday={() => setAnchor(new Date())}
            onNew={() => openNew(new Date())}
          />

          {loading && !data ? (
            <p className="text-sm text-text3">Loading…</p>
          ) : view === 'week' ? (
            <WeekView
              days={weekDays(startOfWeek(anchor))}
              events={events}
              deadlines={deadlines}
              now={new Date()}
              onSlotClick={openNew}
              onEventClick={openEvent}
              onDeadlineClick={openDeadline}
            />
          ) : view === 'month' ? (
            <MonthView
              anchor={anchor}
              events={events}
              deadlines={deadlines}
              onDayClick={(d) => openNew(d)}
              onEventClick={openEvent}
              onDeadlineClick={openDeadline}
            />
          ) : (
            <AgendaView
              days={Array.from({ length: 30 }, (_, i) => addDays(startOfDay(anchor), i))}
              events={events}
              deadlines={deadlines}
              onEventClick={openEvent}
              onDeadlineClick={openDeadline}
            />
          )}
        </div>

        <ContextPanel
          upcoming={upcoming}
          suggestions={suggestions}
          onSuggestion={onSuggestion}
          onDeadlineClick={openDeadline}
        />
      </div>

      <EventEditor
        open={editorOpen}
        initial={draft}
        onClose={() => { setEditorOpen(false); setDraft(null) }}
        onSave={onSave}
        onDelete={onDelete}
      />
    </AppShell>
  )
}
