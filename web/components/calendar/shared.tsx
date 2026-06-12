import type { Deadline } from '@/lib/calendar'

// Muted urgency color for deadline markers (theme-aware CSS vars).
export function deadlineColor(urgency: Deadline['urgency']): string {
  switch (urgency) {
    case 'overdue':
    case 'today': return 'var(--accent3)'
    case 'soon':  return 'var(--warn)'
    default:      return 'var(--accent)'
  }
}

// Small all-day / deadline chip used across week, month and agenda views.
export function DeadlineChip({ d, onClick }: { d: Deadline; onClick?: () => void }) {
  const color = deadlineColor(d.urgency)
  return (
    <button
      onClick={onClick}
      title={d.title}
      className="group flex items-center gap-1.5 w-full text-left px-1.5 py-0.5 rounded-sm hover:bg-surface2 transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="truncate text-[11px] text-text2 group-hover:text-text">{d.title}</span>
    </button>
  )
}
