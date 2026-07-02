// Calendar domain: shared types, local-time date helpers, week-grid layout,
// and pure derivations (deadlines + suggestions) that the API computes from
// the user's tasks. No imports — safe on both client and server.

export type EventType = 'JOB' | 'RESEARCH' | 'PERSONAL' | 'FOCUS'
export type CalendarView = 'week' | 'month' | 'agenda'

export type CalEvent = {
  id: string
  title: string
  start: string // ISO timestamp
  end: string   // ISO timestamp
  allDay: boolean
  type: EventType
  notes: string | null
  source?: 'ANTHILL' | 'GOOGLE' // where the event originated (Google sync)
}

export type Deadline = {
  id: string                 // synthetic, e.g. "task:<id>"
  title: string
  date: string               // 'YYYY-MM-DD' (the intended calendar day)
  kind: 'job' | 'task'
  urgency: 'overdue' | 'today' | 'soon' | 'later'
}

export type Suggestion = {
  id: string
  title: string              // primary line
  detail: string             // secondary line / CTA label
  kind: 'focus' | 'prep' | 'info'
}

export type CalendarData = {
  events: CalEvent[]
  deadlines: Deadline[]
  upcoming: Deadline[]
  suggestions: Suggestion[]
}

// ── Visible time window for the week/day grid ──────────────────────────────
export const DAY_START_HOUR = 7
export const DAY_END_HOUR = 22
export const HOUR_PX = 56
export const GRID_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX

// ── Muted type styling (CSS-var driven, theme-aware) ───────────────────────
export const TYPE_META: Record<EventType, { label: string; bar: string; soft: string; text: string }> = {
  FOCUS:    { label: 'Focus',    bar: 'var(--accent)',  soft: 'var(--accent-soft)',          text: 'var(--accent)' },
  RESEARCH: { label: 'Research', bar: 'var(--accent2)', soft: 'var(--accent2-soft)',         text: 'var(--accent2)' },
  JOB:      { label: 'Job',      bar: 'var(--warn)',    soft: 'rgba(240, 160, 48, 0.12)',    text: 'var(--warn)' },
  PERSONAL: { label: 'Personal', bar: 'var(--text3)',   soft: 'var(--surface3)',             text: 'var(--text2)' },
}

export const EVENT_TYPES: EventType[] = ['FOCUS', 'JOB', 'RESEARCH', 'PERSONAL']

// ── Local-time date helpers ────────────────────────────────────────────────
export function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const offset = (x.getDay() + 6) % 7 // Monday = 0 … Sunday = 6
  return addDays(x, -offset)
}
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}
export function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
export function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1) }
export function monthGridDays(anchor: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(anchor))
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
export function isToday(d: Date): boolean { return sameDay(d, new Date()) }

// 'YYYY-MM-DD' for a Date, in local calendar terms.
export function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// Task deadlines are stored at UTC midnight (the picked date). Read the intended
// calendar day from the UTC parts so it doesn't drift across timezones.
function ymdFromUTC(iso: string): string {
  const d = new Date(iso)
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${m}-${day}`
}

// Range of days to fetch for a given view + anchor date.
export function fetchRange(view: CalendarView, anchor: Date): { start: Date; end: Date } {
  if (view === 'month') {
    const start = startOfWeek(startOfMonth(anchor))
    return { start, end: addDays(start, 42) }
  }
  if (view === 'agenda') {
    const start = startOfDay(anchor)
    return { start, end: addDays(start, 30) }
  }
  const start = startOfWeek(anchor)
  return { start, end: addDays(start, 7) }
}

// ── Week-grid geometry ─────────────────────────────────────────────────────
export function minutesFromDayStart(iso: string): number {
  const d = new Date(iso)
  return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes()
}
export function eventTop(startISO: string): number {
  return Math.max(0, (minutesFromDayStart(startISO) / 60) * HOUR_PX)
}
export function eventHeight(startISO: string, endISO: string): number {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime()
  return Math.max(22, (ms / 3_600_000) * HOUR_PX)
}

// Side-by-side layout for overlapping timed events within one day.
export function layoutDayEvents(events: CalEvent[]): { ev: CalEvent; leftPct: number; widthPct: number }[] {
  const timed = events
    .filter((e) => !e.allDay)
    .slice()
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime() || new Date(b.end).getTime() - new Date(a.end).getTime())

  const result: { ev: CalEvent; leftPct: number; widthPct: number }[] = []
  let cluster: CalEvent[] = []
  let clusterEnd = 0

  const flush = () => {
    const cols: CalEvent[][] = []
    for (const e of cluster) {
      const start = new Date(e.start).getTime()
      let placed = false
      for (const col of cols) {
        if (new Date(col[col.length - 1].end).getTime() <= start) { col.push(e); placed = true; break }
      }
      if (!placed) cols.push([e])
    }
    const n = cols.length || 1
    cols.forEach((col, ci) => col.forEach((e) => result.push({ ev: e, leftPct: (ci / n) * 100, widthPct: (1 / n) * 100 })))
    cluster = []
    clusterEnd = 0
  }

  for (const e of timed) {
    const start = new Date(e.start).getTime()
    if (cluster.length && start >= clusterEnd) flush()
    cluster.push(e)
    clusterEnd = Math.max(clusterEnd, new Date(e.end).getTime())
  }
  if (cluster.length) flush()
  return result
}

export function formatHourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`
}
export function formatTimeRange(startISO: string, endISO: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString(undefined, opts).replace(':00', '')
  return `${fmt(startISO)} – ${fmt(endISO)}`
}

// ── Pure derivations (called by the API from the user's task rows) ─────────
type TaskLike = { id: string; title: string; deadline: string | null; completed: boolean; linkedJobId: string | null }

function urgencyFor(dateYmd: string, todayYmd: string): Deadline['urgency'] {
  if (dateYmd < todayYmd) return 'overdue'
  if (dateYmd === todayYmd) return 'today'
  const diffDays = Math.round((Date.parse(dateYmd) - Date.parse(todayYmd)) / 86_400_000)
  return diffDays <= 3 ? 'soon' : 'later'
}

// Incomplete, dated tasks become all-day deadline markers within [start, end).
export function deriveDeadlines(tasks: TaskLike[], start: Date, end: Date, today: Date): Deadline[] {
  const startYmd = ymd(start), endYmd = ymd(end), todayYmd = ymd(today)
  return tasks
    .filter((t) => !t.completed && t.deadline)
    .map((t) => ({ t, date: ymdFromUTC(t.deadline as string) }))
    .filter(({ date }) => date >= startYmd && date < endYmd)
    .map(({ t, date }) => ({
      id: `task:${t.id}`,
      title: t.title,
      date,
      kind: (t.linkedJobId ? 'job' : 'task') as Deadline['kind'],
      urgency: urgencyFor(date, todayYmd),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Soonest upcoming deadlines from today forward (for the side panel).
export function deriveUpcoming(tasks: TaskLike[], today: Date, limit = 5): Deadline[] {
  const todayYmd = ymd(today)
  return tasks
    .filter((t) => !t.completed && t.deadline)
    .map((t) => ({ t, date: ymdFromUTC(t.deadline as string) }))
    .filter(({ date }) => date >= todayYmd)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
    .map(({ t, date }) => ({
      id: `task:${t.id}`,
      title: t.title,
      date,
      kind: (t.linkedJobId ? 'job' : 'task') as Deadline['kind'],
      urgency: urgencyFor(date, todayYmd),
    }))
}

export function buildSuggestions(upcoming: Deadline[], today: Date): Suggestion[] {
  const todayYmd = ymd(today)
  const in7 = ymd(addDays(today, 7))
  const tomorrowYmd = ymd(addDays(today, 1))
  const out: Suggestion[] = []

  const next7 = upcoming.filter((d) => d.date >= todayYmd && d.date <= in7)
  if (next7.length >= 2) {
    out.push({ id: 'deadlines', title: `You have ${next7.length} deadlines coming up.`, detail: 'Reserve focus time', kind: 'focus' })
  }

  const interview = upcoming.find((d) => /interview/i.test(d.title) && (d.date === todayYmd || d.date === tomorrowYmd))
  if (interview) {
    out.push({ id: 'interview', title: `${interview.title}`, detail: 'Block 1 hr of prep before', kind: 'prep' })
  }

  if (out.length === 0) {
    const soonest = upcoming.find((d) => d.urgency !== 'overdue')
    if (soonest) out.push({ id: 'next', title: `Next up: ${soonest.title}`, detail: 'Reserve time to prepare', kind: 'info' })
    else out.push({ id: 'empty', title: 'Your week is open.', detail: 'Block time for deep work', kind: 'focus' })
  }

  return out.slice(0, 3)
}
