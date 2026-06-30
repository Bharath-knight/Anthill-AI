'use client'
import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Calendar, ExternalLink } from 'lucide-react'
import { TaskCheckbox } from './TaskRow'
import type { Task } from './TaskRow'
import { relativeLabel, toDateInputValue } from '@/lib/smart-date'

type TaskPatch = { title?: string; description?: string | null; deadline?: string | null; completed?: boolean }

export function TaskDetailPane({
  task,
  onClose,
  onPatch,
  onDelete,
}: {
  task: Task | null
  onClose: () => void
  onPatch: (id: string, partial: TaskPatch) => void
  onDelete: (id: string) => void
}) {
  const open = !!task
  // Keep the last task rendered through the close animation so content doesn't blank mid-slide.
  const [shown, setShown] = useState<Task | null>(task)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const dateRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (task) setShown(task)
  }, [task])

  useEffect(() => {
    if (shown) {
      setTitle(shown.title)
      setDesc(shown.description ?? '')
    }
  }, [shown?.id])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Move focus into the pane on open; restore it to the opener on close.
  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null
      requestAnimationFrame(() => closeRef.current?.focus())
    } else {
      restoreRef.current?.focus?.()
      restoreRef.current = null
    }
  }, [open])

  function commitTitle() {
    if (!shown) return
    const next = title.trim()
    if (!next) {
      setTitle(shown.title) // reject empty
      return
    }
    if (next !== shown.title) onPatch(shown.id, { title: next })
  }

  function commitDesc() {
    if (!shown) return
    const next = desc.trim() ? desc : ''
    if (next !== (shown.description ?? '')) onPatch(shown.id, { description: next || null })
  }

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        aria-hidden={!open}
        {...((open ? {} : { inert: '' }) as any)}
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-surface border-l border-border shadow-lg flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {shown && (
          <>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <TaskCheckbox
                completed={shown.completed}
                deadline={shown.deadline}
                onToggle={() => onPatch(shown.id, { completed: !shown.completed })}
              />
              <span className="text-xs text-text3">{shown.completed ? 'Completed' : 'Open task'}</span>
              <button
                ref={closeRef}
                onClick={onClose}
                className="ml-auto w-7 h-7 grid place-items-center rounded text-text2 hover:text-text hover:bg-surface3 transition-colors"
                aria-label="Close"
              >
                <X size={16} strokeWidth={2.25} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitTitle}
                rows={2}
                className={`w-full bg-transparent border-none outline-none resize-none text-lg font-semibold leading-snug text-text placeholder:text-text3 ${
                  shown.completed ? 'line-through text-text3' : ''
                }`}
                placeholder="Task title"
              />

              <div>
                <FieldLabel>Due date</FieldLabel>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const el = dateRef.current
                      if (!el) return
                      if (typeof el.showPicker === 'function') el.showPicker()
                      else el.focus()
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-surface2 hover:bg-surface3 text-sm text-text transition-colors"
                  >
                    <Calendar size={14} strokeWidth={2.25} className="text-text3" />
                    {shown.deadline ? relativeLabel(shown.deadline) : 'Add date'}
                  </button>
                  <input
                    ref={dateRef}
                    type="date"
                    value={toDateInputValue(shown.deadline)}
                    onChange={(e) => onPatch(shown.id, { deadline: e.target.value || null })}
                    className="sr-only"
                  />
                  {shown.deadline && (
                    <button
                      onClick={() => onPatch(shown.id, { deadline: null })}
                      className="text-text3 hover:text-accent3 transition-colors"
                      aria-label="Clear date"
                    >
                      <X size={14} strokeWidth={2.25} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <FieldLabel>Notes</FieldLabel>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  onBlur={commitDesc}
                  rows={4}
                  placeholder="Add notes…"
                  className="w-full bg-surface2 border border-border rounded p-3 text-sm text-text placeholder:text-text3 resize-y focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              {shown.linkedJob && (
                <div>
                  <FieldLabel>Linked job</FieldLabel>
                  <span className="inline-flex items-center rounded-full bg-surface3 px-2.5 py-1 text-xs text-text2">
                    {shown.linkedJob.company} — {shown.linkedJob.role}
                  </span>
                  <a
                    href={shown.linkedJob.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded border border-border bg-surface2 px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-surface3 transition-colors"
                  >
                    Apply <ExternalLink size={12} strokeWidth={2.25} />
                  </a>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border">
              <button
                onClick={() => {
                  onDelete(shown.id)
                  onClose()
                }}
                className="inline-flex items-center gap-1.5 text-xs text-text2 hover:text-accent3 transition-colors"
              >
                <Trash2 size={13} strokeWidth={2.25} /> Delete task
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-text2 mb-1.5">{children}</label>
}
