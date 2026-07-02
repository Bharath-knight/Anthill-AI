'use client'
import { CalEvent, Deadline, TYPE_META, monthGridDays, sameDay, isToday, ymd } from '@/lib/google/calendar'
import { deadlineColor } from './shared'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type Props = {
  anchor: Date
  events: CalEvent[]
  deadlines: Deadline[]
  onDayClick: (day: Date) => void
  onEventClick: (ev: CalEvent) => void
  onDeadlineClick: (d: Deadline) => void
}

export function MonthView({ anchor, events, deadlines, onDayClick, onEventClick, onDeadlineClick }: Props) {
  const days = monthGridDays(anchor)
  const month = anchor.getMonth()

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-[10px] font-medium uppercase tracking-wide text-text3 text-center">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, idx) => {
          const inMonth = d.getMonth() === month
          const dayKey = ymd(d)
          const dayEvents = events.filter((e) => sameDay(new Date(e.start), d))
          const dayDeadlines = deadlines.filter((dl) => dl.date === dayKey)
          const items: ({ k: 'e'; e: CalEvent } | { k: 'd'; dl: Deadline })[] = [
            ...dayDeadlines.map((dl) => ({ k: 'd' as const, dl })),
            ...dayEvents.map((e) => ({ k: 'e' as const, e })),
          ]
          const shown = items.slice(0, 3)
          const more = items.length - shown.length
          return (
            <div
              key={idx}
              onClick={() => onDayClick(d)}
              className={`text-left min-h-[100px] p-1.5 border-b border-l border-border [&:nth-child(7n+1)]:border-l-0 cursor-pointer hover:bg-surface2/40 transition-colors ${inMonth ? '' : 'opacity-40'}`}
            >
              <div className="flex justify-end">
                <span className={`text-xs grid place-items-center w-6 h-6 rounded-full ${isToday(d) ? 'bg-accent text-bg font-semibold' : 'text-text2'}`}>
                  {d.getDate()}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {shown.map((it, i) =>
                  it.k === 'e' ? (
                    <div
                      key={i}
                      onClick={(ev) => { ev.stopPropagation(); onEventClick(it.e) }}
                      className="flex items-center gap-1 px-1 py-0.5 rounded-sm"
                      style={{ backgroundColor: TYPE_META[it.e.type].soft }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_META[it.e.type].bar }} />
                      <span className="truncate text-[10px] text-text">{it.e.title}</span>
                    </div>
                  ) : (
                    <div
                      key={i}
                      onClick={(ev) => { ev.stopPropagation(); onDeadlineClick(it.dl) }}
                      className="flex items-center gap-1 px-1 py-0.5 rounded-sm hover:bg-surface2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: deadlineColor(it.dl.urgency) }} />
                      <span className="truncate text-[10px] text-text2">{it.dl.title}</span>
                    </div>
                  )
                )}
                {more > 0 && <div className="text-[10px] text-text3 px-1">+{more} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
