'use client'
import { useState } from 'react'
import { Calendar, ArrowUpRight, ChevronDown, ChevronUp, X, Pencil, ArrowLeftRight } from 'lucide-react'
import { Tag, TypeDot } from './Tag'
import { StatusSelect } from './StatusBadge'

export type JobEvent = {
  id: string
  type: string
  fromStatus: string | null
  toStatus: string | null
  createdAt: string
}

export type Job = {
  id: string
  company: string
  role: string
  location: string | null
  deadline: string
  link: string
  notes: string | null
  status: string
  createdAt: string
  events?: JobEvent[]
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

type Props = {
  job: Job
  taskCount?: number
  onStatusChange?: (id: string, status: string) => void
  onNotesChange?: (id: string, notes: string) => void
  onDelete?: (id: string) => void
  onEdit?: (job: Job) => void
  onReclassify?: (id: string) => void
}

export function JobCard({ job, taskCount, onStatusChange, onNotesChange, onDelete, onEdit, onReclassify }: Props) {
  const [open, setOpen] = useState(false)
  const hasDeadline = job.deadline && job.deadline !== 'Deadline not given'

  return (
    <div
      className="group glass-pane bg-surface border border-border rounded-lg transition-colors duration-150 hover:border-border2"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="pt-1.5">
          <TypeDot color="accent" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-text truncate">{job.role}</span>
            <span className="text-text3 text-xs">·</span>
            <span className="text-sm text-text2 truncate">{job.company}</span>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {job.location && <Tag>{job.location}</Tag>}
            {hasDeadline && (
              <Tag variant="warn">
                <Calendar size={11} strokeWidth={2.25} />
                {job.deadline}
              </Tag>
            )}
            {taskCount ? <Tag variant="accent2">{taskCount} task{taskCount > 1 ? 's' : ''}</Tag> : null}
          </div>

          <div className="flex items-center gap-3 mt-3 text-xs">
            <a
              href={job.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-text2 hover:text-accent transition-colors"
            >
              <ArrowUpRight size={13} strokeWidth={2.25} /> Open
            </a>
            <button
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-text2 hover:text-text transition-colors"
            >
              {open ? <><ChevronUp size={13} strokeWidth={2.25} /> Less</> : <><ChevronDown size={13} strokeWidth={2.25} /> More</>}
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(job)}
                className="inline-flex items-center gap-1 text-text2 hover:text-text transition-colors"
              >
                <Pencil size={12} strokeWidth={2.25} /> Edit
              </button>
            )}
            {onReclassify && (
              <button
                onClick={() => {
                  if (confirm('Move this to Research? It will no longer be tracked as a job.')) onReclassify(job.id)
                }}
                className="inline-flex items-center gap-1 text-text2 hover:text-text transition-colors"
              >
                <ArrowLeftRight size={12} strokeWidth={2.25} /> Not a job
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('Delete this job?')) onDelete(job.id)
                }}
                className="text-text3 hover:text-accent3 transition-colors ml-auto opacity-0 group-hover:opacity-100"
                aria-label="Delete job"
              >
                <X size={14} strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {onStatusChange ? (
            <StatusSelect value={job.status} onChange={(s) => onStatusChange(job.id, s)} />
          ) : (
            <Tag>{job.status}</Tag>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-surface2/40">
          <textarea
            defaultValue={job.notes ?? ''}
            onBlur={(e) => onNotesChange?.(job.id, e.target.value)}
            placeholder="Notes..."
            rows={2}
            className="w-full text-xs text-text bg-transparent border border-border rounded p-2 resize-y focus:outline-none focus:border-border2 placeholder:text-text3"
          />
          {job.events && job.events.length > 0 && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-text3 mb-1.5">
                History
              </div>
              <div className="flex flex-wrap gap-2">
                {job.events.map((ev) => (
                  <span key={ev.id} className="text-[11px] text-text2">
                    {ev.toStatus} · {timeAgo(ev.createdAt)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
