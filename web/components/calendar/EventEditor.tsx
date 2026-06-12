'use client'
import { useEffect, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextInput, Textarea, FieldLabel } from '@/components/Input'
import { EVENT_TYPES, TYPE_META, type EventType } from '@/lib/calendar'

export type EventDraft = {
  id?: string
  title: string
  type: EventType
  date: string       // 'YYYY-MM-DD'
  startTime: string  // 'HH:MM'
  endTime: string    // 'HH:MM'
  allDay: boolean
  notes: string
}

type Props = {
  open: boolean
  initial: EventDraft | null
  onClose: () => void
  onSave: (draft: EventDraft) => void
  onDelete: (id: string) => void
}

export function EventEditor({ open, initial, onClose, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<EventDraft | null>(initial)

  useEffect(() => { setDraft(initial) }, [initial])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !draft) return null

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))

  const canSave = draft.title.trim().length > 0
  const isEdit = !!draft.id

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md glass-pane bg-surface border border-border rounded-lg shadow-lg p-5 space-y-4 toast-enter">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text">{isEdit ? 'Edit event' : 'New event'}</h3>
          <button onClick={onClose} className="text-text3 hover:text-text transition-colors" aria-label="Close">
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>

        <div>
          <FieldLabel>Title</FieldLabel>
          <TextInput
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSave) onSave(draft) }}
            placeholder="What's this block for?"
          />
        </div>

        <div>
          <FieldLabel>Type</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPES.map((t) => {
              const active = draft.type === t
              const meta = TYPE_META[t]
              return (
                <button
                  key={t}
                  onClick={() => set('type', t)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    active ? 'text-text' : 'text-text2 border-transparent hover:bg-surface2'
                  }`}
                  style={active ? { backgroundColor: meta.soft, borderColor: meta.bar } : undefined}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.bar }} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <FieldLabel>Date</FieldLabel>
            <TextInput type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-text2 mt-5 cursor-pointer select-none">
            <input type="checkbox" checked={draft.allDay} onChange={(e) => set('allDay', e.target.checked)} className="accent-[var(--accent)]" />
            All day
          </label>
        </div>

        {!draft.allDay && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <FieldLabel>Start</FieldLabel>
              <TextInput type="time" value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </div>
            <div className="flex-1">
              <FieldLabel>End</FieldLabel>
              <TextInput type="time" value={draft.endTime} onChange={(e) => set('endTime', e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <FieldLabel>Notes</FieldLabel>
          <Textarea rows={2} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
        </div>

        <div className="flex items-center justify-between pt-1">
          {isEdit ? (
            <button
              onClick={() => onDelete(draft.id as string)}
              className="inline-flex items-center gap-1.5 text-sm text-text3 hover:text-accent3 transition-colors"
            >
              <Trash2 size={15} strokeWidth={2} /> Delete
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!canSave} onClick={() => onSave(draft)}>
              {isEdit ? 'Save' : 'Add event'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
