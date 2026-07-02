'use client'
import { useEffect, useRef, useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { authedFetch } from '@/lib/auth/api-client'
import { useToast } from '@/components/ui/Toast'
import type { Job } from '@/components/jobs/JobCard'
import type { ResearchItem } from '@/components/research/ResearchCard'

export type Captured =
  | { type: 'job'; job: Job }
  | { type: 'research'; item: ResearchItem }

type Props = { onCaptured: (captured: Captured) => void }

function isLikelyUrl(s: string): boolean {
  try {
    const u = new URL(s.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function PasteCapture({ onCaptured }: Props) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  // Cmd/Ctrl+V anywhere on the page focuses the input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'v') {
        const tag = (document.activeElement?.tagName || '').toLowerCase()
        if (tag === 'input' || tag === 'textarea') return
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    if (!isLikelyUrl(trimmed)) {
      toast.error('Not a valid URL', 'Paste a link starting with http(s).')
      return
    }
    setBusy(true)
    try {
      const res = await authedFetch('/api/capture', {
        method: 'POST',
        body: JSON.stringify({ sourceUrl: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(res.status === 409 ? 'Already saved' : (data.error || 'Capture failed'))
        return
      }
      setValue('')
      if (data.type === 'research') {
        toast.success('Saved as research', data.domain || undefined)
        onCaptured({ type: 'research', item: data as ResearchItem })
      } else {
        toast.success('Captured', `${data.company || ''} — ${data.role || ''}`)
        onCaptured({ type: 'job', job: data as Job })
      }
    } catch {
      toast.error('Cannot reach API')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-pane bg-surface border border-border rounded-lg p-4 mb-6">
      <div className="text-[11px] font-medium uppercase tracking-wide text-text3 mb-2">
        Paste a URL
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Link2
            size={14}
            strokeWidth={2.25}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text3 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="url"
            placeholder="https://example.com/jobs/123"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            disabled={busy}
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface2 border border-border rounded text-text placeholder:text-text3 focus:outline-none focus:border-accent focus:bg-surface3 transition-colors disabled:opacity-60"
          />
        </div>
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-accent text-bg hover:opacity-90 disabled:bg-surface3 disabled:text-text3 disabled:opacity-100 transition-opacity"
        >
          {busy ? (
            <>
              <Loader2 size={14} strokeWidth={2.25} className="animate-spin" />
              Capturing...
            </>
          ) : (
            'Capture'
          )}
        </button>
      </div>
    </div>
  )
}
