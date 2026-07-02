'use client'
import {
  CalEvent, Deadline, TYPE_META, HOUR_PX, GRID_HEIGHT, DAY_START_HOUR, DAY_END_HOUR,
  eventTop, eventHeight, layoutDayEvents, formatHourLabel, formatTimeRange, sameDay, isToday, ymd,
} from '@/lib/google/calendar'
import { DeadlineChip } from './shared'

const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i)
const COLS = '48px repeat(7, minmax(0, 1fr))'

type Props = {
  days: Date[]
  events: CalEvent[]
  deadlines: Deadline[]
  now: Date
  onSlotClick: (day: Date, hour: number) => void
  onEventClick: (ev: CalEvent) => void
  onDeadlineClick: (d: Deadline) => void
}

export function WeekView({ days, events, deadlines, now, onSlotClick, onEventClick, onDeadlineClick }: Props) {
  const nowMins = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes()
  const nowTop = nowMins >= 0 && nowMins <= (DAY_END_HOUR - DAY_START_HOUR) * 60 ? (nowMins / 60) * HOUR_PX : null

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <div className="min-w-[720px]">
        {/* Day headers */}
        <div className="sticky top-0 z-20 grid bg-surface/95 backdrop-blur border-b border-border" style={{ gridTemplateColumns: COLS }}>
          <div className="h-14" />
          {days.map((d) => {
            const today = isToday(d)
            return (
              <div key={d.toISOString()} className="h-14 flex flex-col items-center justify-center border-l border-border">
                <span className="text-[10px] font-medium uppercase tracking-wide text-text3">
                  {d.toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <span
                  className={`mt-0.5 text-sm grid place-items-center w-7 h-7 rounded-full ${
                    today ? 'bg-accent text-bg font-semibold' : 'text-text2'
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
            )
          })}
        </div>

        {/* All-day row: all-day events + derived deadlines */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: COLS }}>
          <div className="flex items-start justify-end pr-2 pt-1.5 text-[10px] font-mono text-text3">all-day</div>
          {days.map((d) => {
            const dayKey = ymd(d)
            const allDayEvents = events.filter((e) => e.allDay && sameDay(new Date(e.start), d))
            const dayDeadlines = deadlines.filter((dl) => dl.date === dayKey)
            return (
              <div key={d.toISOString()} className="border-l border-border p-1 space-y-0.5 min-h-[36px]">
                {allDayEvents.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    title={e.title}
                    className="flex items-center gap-1.5 w-full text-left px-1.5 py-0.5 rounded-sm hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: TYPE_META[e.type].soft }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_META[e.type].bar }} />
                    <span className="truncate text-[11px] text-text">{e.title}</span>
                  </button>
                ))}
                {dayDeadlines.map((dl) => (
                  <DeadlineChip key={dl.id} d={dl} onClick={() => onDeadlineClick(dl)} />
                ))}
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="grid relative" style={{ gridTemplateColumns: COLS, height: GRID_HEIGHT }}>
          {/* Hour gutter */}
          <div className="relative">
            {HOURS.map((h, i) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-mono text-text3"
                style={{ top: i * HOUR_PX }}
              >
                {i === 0 ? '' : formatHourLabel(h)}
              </span>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const dayEvents = events.filter((e) => !e.allDay && sameDay(new Date(e.start), d))
            const laid = layoutDayEvents(dayEvents)
            const showNow = isToday(d) && nowTop !== null
            return (
              <div key={d.toISOString()} className="relative border-l border-border">
                {/* Hour cells (click to create) */}
                {HOURS.map((h, i) => (
                  <button
                    key={h}
                    onClick={() => onSlotClick(d, h)}
                    aria-label={`Add event at ${formatHourLabel(h)}`}
                    className="absolute inset-x-0 border-t border-border/50 hover:bg-surface2/50 transition-colors"
                    style={{ top: i * HOUR_PX, height: HOUR_PX }}
                  />
                ))}

                {/* Now indicator */}
                {showNow && (
                  <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: nowTop as number }}>
                    <div className="h-px bg-accent" />
                    <div className="absolute -left-0.5 -top-[3px] w-1.5 h-1.5 rounded-full bg-accent" />
                  </div>
                )}

                {/* Timed events */}
                {laid.map(({ ev, leftPct, widthPct }) => {
                  const meta = TYPE_META[ev.type]
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      title={ev.title}
                      className="absolute z-10 rounded-md text-left px-2 py-1 overflow-hidden border-l-2 hover:shadow transition-shadow"
                      style={{
                        top: eventTop(ev.start),
                        height: eventHeight(ev.start, ev.end),
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: meta.soft,
                        borderColor: meta.bar,
                      }}
                    >
                      <div className="text-[11px] font-medium text-text leading-tight truncate">{ev.title}</div>
                      <div className="text-[10px] font-mono text-text3 truncate">{formatTimeRange(ev.start, ev.end)}</div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
