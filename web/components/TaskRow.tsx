'use client'
import { Check, X } from 'lucide-react'
import { urgency, relativeLabel, type Urgency } from '@/lib/smart-date'

export type Task = {
  id: string
  title: string
  description: string | null
  completed: boolean
  deadline: string | null
  linkedJobId: string | null
  linkedJob: { id: string; company: string; role: string } | null
}

// Ring color is derived purely from deadline urgency (Anthill has no priority field).
const RING: Record<Urgency, string> = {
  overdue: 'border-accent3',
  today: 'border-warn',
  upcoming: 'border-border2',
  none: 'border-border2',
}

const CHIP: Record<Urgency, string> = {
  overdue: 'text-accent3',
  today: 'text-warn',
  upcoming: 'text-text3',
  none: 'text-text3',
}

export function TaskCheckbox({
  completed,
  deadline,
  onToggle,
  size = 18,
}: {
  completed: boolean
  deadline: string | null
  onToggle: () => void
  size?: number
}) {
  const ring = completed ? 'bg-accent border-accent text-white' : `${RING[urgency(deadline)]} hover:border-accent`
  return (
    // Padding (with negative margin) gives a ≥24px touch target while the
    // visible ring stays at `size`px and layout is unchanged.
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className="shrink-0 grid place-items-center p-1.5 -m-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
    >
      <span
        className={`grid place-items-center rounded-full border-2 transition-colors duration-150 ${ring}`}
        style={{ width: size, height: size }}
      >
        {completed && <Check size={Math.round(size * 0.6)} strokeWidth={3} />}
      </span>
    </button>
  )
}

export function TaskRow({
  task,
  selected,
  onToggle,
  onOpen,
  onDelete,
}: {
  task: Task
  selected: boolean
  onToggle: (id: string, completed: boolean) => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  const u = urgency(task.deadline)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={task.title}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(task.id)
        }
      }}
      className={`group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? 'bg-accent-soft' : 'hover:bg-surface3'
      }`}
    >
      <TaskCheckbox
        completed={task.completed}
        deadline={task.deadline}
        onToggle={() => onToggle(task.id, !task.completed)}
      />

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug truncate ${
            task.completed ? 'line-through text-text3' : 'text-text font-medium'
          }`}
        >
          {task.title}
        </p>
        {task.linkedJob && (
          <p className="text-[11px] text-text3 truncate mt-0.5">
            {task.linkedJob.company} — {task.linkedJob.role}
          </p>
        )}
      </div>

      {task.deadline && (
        <span className={`shrink-0 text-[11px] font-medium ${task.completed ? 'text-text3' : CHIP[u]}`}>
          {relativeLabel(task.deadline)}
        </span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(task.id)
        }}
        className="shrink-0 grid place-items-center p-1.5 rounded text-text3 hover:text-accent3 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Delete task"
      >
        <X size={14} strokeWidth={2.25} />
      </button>
    </div>
  )
}
