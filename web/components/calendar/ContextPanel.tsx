'use client'
import { CalendarClock, Sparkles, Calendar as CalIcon, ChevronRight } from 'lucide-react'
import { Deadline, Suggestion } from '@/lib/calendar'
import { relativeLabel } from '@/lib/smart-date'
import { deadlineColor } from './shared'

type Props = {
  upcoming: Deadline[]
  suggestions: Suggestion[]
  onSuggestion: (s: Suggestion) => void
  onDeadlineClick: (d: Deadline) => void
}

export function ContextPanel({ upcoming, suggestions, onSuggestion, onDeadlineClick }: Props) {
  return (
    <aside className="hidden xl:flex flex-col w-80 shrink-0 border-l border-border bg-surface2/40 p-5 gap-7 overflow-y-auto">
      <section>
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-text3 mb-3">Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-text3">Nothing on the horizon.</p>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((d) => (
              <button key={d.id} onClick={() => onDeadlineClick(d)} className="flex items-start gap-2.5 w-full text-left group">
                <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: deadlineColor(d.urgency) }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-text truncate group-hover:text-accent transition-colors">{d.title}</div>
                  <div className="text-[11px] text-text3 flex items-center gap-1.5 mt-0.5">
                    <CalendarClock size={11} strokeWidth={2} /> {relativeLabel(d.date)}
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase text-text3 mt-0.5 shrink-0">{d.kind}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-text3 mb-3 flex items-center gap-1.5">
          <Sparkles size={12} strokeWidth={2} /> Anthill suggestions
        </h3>
        <div className="space-y-2">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => onSuggestion(s)}
              className="block w-full text-left rounded-lg border border-border bg-surface p-3 hover:border-border2 hover:-translate-y-px transition-all group"
            >
              <div className="text-sm text-text leading-snug">{s.title}</div>
              <div className="mt-1.5 flex items-center gap-1 text-[12px] text-accent">
                {s.detail}
                <ChevronRight size={13} strokeWidth={2.25} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-auto pt-4 border-t border-border">
        <div className="flex items-center gap-2 text-[12px] text-text2">
          <CalIcon size={13} strokeWidth={2} /> Connected to Google Calendar
        </div>
        <div className="text-[11px] text-text3 mt-1">Manage integration</div>
      </div>
    </aside>
  )
}
