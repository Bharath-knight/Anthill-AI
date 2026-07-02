// Client-only date helpers for the Tasks view. No server imports.
//
// Deadlines are stored as date-only values at midnight UTC (the date the user
// picked round-trips through `new Date('YYYY-MM-DD')`). So the *picked date* is
// the deadline's UTC calendar date — we read it via getUTC* and compare against
// today's *local* calendar date. This shows the date the user actually chose,
// regardless of their timezone, without changing how dates are stored.

export type Urgency = 'overdue' | 'today' | 'upcoming' | 'none'
export type TaskView = 'all' | 'today' | 'next7' | 'upcoming' | 'nodate' | 'completed'

export const TASK_VIEWS: TaskView[] = ['all', 'today', 'next7', 'upcoming', 'nodate', 'completed']
export const DEFAULT_VIEW: TaskView = 'all'

type TaskLike = { completed: boolean; deadline: string | null }

const DAY = 86400000

// Picked date of a deadline, expressed as a UTC-midnight timestamp.
function dueDayUTC(deadline: string): number {
  const d = new Date(deadline)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// Today's local calendar date, expressed as a UTC-midnight timestamp (for diffing).
function todayDayUTC(): number {
  const n = new Date()
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())
}

export function urgency(deadline: string | null): Urgency {
  if (!deadline) return 'none'
  const diff = Math.round((dueDayUTC(deadline) - todayDayUTC()) / DAY)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  return 'upcoming'
}

export function relativeLabel(deadline: string | null): string {
  if (!deadline) return ''
  const diff = Math.round((dueDayUTC(deadline) - todayDayUTC()) / DAY)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < -1) return `${Math.abs(diff)}d overdue`
  const d = new Date(deadline)
  if (diff <= 6) {
    return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Matches a task's date against a view's bucket, ignoring completion.
function matchesBucket(task: TaskLike, view: TaskView): boolean {
  if (view === 'nodate') return task.deadline === null
  if (task.deadline === null) return false
  const diff = Math.round((dueDayUTC(task.deadline) - todayDayUTC()) / DAY)
  switch (view) {
    case 'today':
      return diff <= 0 // overdue rolls into Today, matching TickTick
    case 'next7':
      return diff >= 0 && diff <= 7
    case 'upcoming':
      return diff > 7
    default:
      return false
  }
}

export function pendingForView<T extends TaskLike>(tasks: T[], view: TaskView): T[] {
  if (view === 'completed') return []
  if (view === 'all') return tasks.filter((t) => !t.completed)
  return tasks.filter((t) => !t.completed && matchesBucket(t, view))
}

export function completedForView<T extends TaskLike>(tasks: T[], view: TaskView): T[] {
  if (view === 'completed' || view === 'all') return tasks.filter((t) => t.completed)
  return tasks.filter((t) => t.completed && matchesBucket(t, view))
}

// 'YYYY-MM-DD' value for an <input type="date"> from a stored deadline.
// Reads the deadline's UTC calendar date — i.e. the date the user picked.
export function toDateInputValue(deadline: string | null): string {
  if (!deadline) return ''
  return new Date(deadline).toISOString().slice(0, 10)
}

// Local calendar date offset by `days`, as 'YYYY-MM-DD' (for seeding new tasks).
export function plusDaysInputValue(days: number): string {
  const n = new Date()
  n.setDate(n.getDate() + days)
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return `${n.getFullYear()}-${m}-${d}`
}

// Today's local calendar date as 'YYYY-MM-DD'.
export function todayInputValue(): string {
  return plusDaysInputValue(0)
}

// Seed a deadline so a newly-added task lands inside the active smart list.
export function seedDeadlineForView(view: TaskView): string | null {
  switch (view) {
    case 'today':
    case 'next7':
      return todayInputValue()       // diff 0 satisfies both buckets
    case 'upcoming':
      return plusDaysInputValue(8)    // needs diff > 7
    default:
      return null                     // 'nodate' (and 'completed', unused)
  }
}
