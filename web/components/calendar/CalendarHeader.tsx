'use client'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { CalendarView } from '@/lib/google/calendar'

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'agenda', label: 'Agenda' },
]

type Props = {
  view: CalendarView
  label: string
  onView: (v: CalendarView) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onNew: () => void
}

export function CalendarHeader({ view, label, onView, onPrev, onNext, onToday, onNew }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onToday}
          className="text-sm px-3 py-1.5 rounded border border-border text-text2 hover:text-text hover:bg-surface2 transition-colors"
        >
          Today
        </button>
        <div className="flex items-center">
          <button onClick={onPrev} aria-label="Previous" className="w-8 h-8 grid place-items-center rounded text-text2 hover:text-text hover:bg-surface2 transition-colors">
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <button onClick={onNext} aria-label="Next" className="w-8 h-8 grid place-items-center rounded text-text2 hover:text-text hover:bg-surface2 transition-colors">
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-text ml-1 truncate">{label}</h2>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-surface2 border border-border">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => onView(v.id)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                view === v.id ? 'bg-surface text-text shadow-sm' : 'text-text2 hover:text-text'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded bg-accent text-bg hover:shadow-[0_0_18px_var(--accent-soft)] transition-all"
        >
          <Plus size={15} strokeWidth={2.5} /> New
        </button>
      </div>
    </div>
  )
}
