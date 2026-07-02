'use client'
import { CalendarDays } from 'lucide-react'
import { CalEvent, Deadline, TYPE_META, formatTimeRange, ymd, sameDay } from '@/lib/google/calendar'
import { deadlineColor } from './shared'
import { EmptyState } from '@/components/ui/EmptyState'

type Props = {
  days: Date[]
  events: CalEvent[]
  deadlines: Deadline[]
  onEventClick: (ev: CalEvent) => void
  onDeadlineClick: (d: Deadline) => void
}

export function AgendaView({ days, events, deadlines, onEventClick, onDeadlineClick }: Props) {
  const groups = days
    .map((d) => {
      const dayKey = ymd(d)
      const evs = events
        .filter((e) => sameDay(new Date(e.start), d))
        .sort((a, b) => (a.allDay ? 0 : new Date(a.start).getTime()) - (b.allDay ? 0 : new Date(b.start).getTime()))
      const dls = deadlines.filter((dl) => dl.date === dayKey)
      return { d, evs, dls }
    })
    .filter((g) => g.evs.length || g.dls.length)

  if (!groups.length) {
    return (
      <EmptyState
        icon={<CalendarDays size={32} strokeWidth={1.5} />}
        title="Nothing scheduled"
        subtitle="Add an event or set deadlines on your tasks to see them here."
      />
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface divide-y divide-border">
      {groups.map((g) => (
        <div key={g.d.toISOString()} className="p-3 sm:p-4 flex gap-4">
          <div className="w-14 shrink-0">
            <div className="text-2xl font-semibold text-text leading-none">{g.d.getDate()}</div>
            <div className="text-[11px] text-text3 uppercase tracking-wide mt-1">
              {g.d.toLocaleDateString(undefined, { weekday: 'short', month: 'short' })}
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {g.dls.map((dl) => (
              <div
                key={dl.id}
                onClick={() => onDeadlineClick(dl)}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: deadlineColor(dl.urgency) }} />
                <span className="text-sm text-text2 group-hover:text-text truncate">{dl.title}</span>
                <span className="text-[11px] text-text3 ml-auto shrink-0">deadline</span>
              </div>
            ))}
            {g.evs.map((e) => (
              <div
                key={e.id}
                onClick={() => onEventClick(e)}
                className="flex items-center gap-2.5 cursor-pointer rounded-md px-2 py-1.5 -mx-2 hover:bg-surface2 transition-colors"
              >
                <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: TYPE_META[e.type].bar }} />
                <div className="min-w-0">
                  <div className="text-sm text-text truncate">{e.title}</div>
                  <div className="text-[11px] font-mono text-text3">{e.allDay ? 'All day' : formatTimeRange(e.start, e.end)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
