'use client'
import { useEffect, useState } from 'react'
import { Calendar as CalIcon } from 'lucide-react'
import { authedFetch } from '@/lib/auth/api-client'
import { useToast } from '@/components/ui/Toast'

type Status = { connected: boolean; email: string | null; configured: boolean }

// Replaces the old static "Connected to Google Calendar" placeholder with a
// real connect/disconnect control backed by /api/google/*.
export function GoogleCalendarConnect({ onChange }: { onChange?: () => void }) {
  const toast = useToast()
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const r = await authedFetch('/api/google/status')
      if (r.ok) setStatus(await r.json())
    } catch {
      /* keep panel quiet on failure */
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function connect() {
    setBusy(true)
    try {
      const r = await authedFetch('/api/google/connect')
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.url) {
        toast.error(j.error || 'Could not start Google connection')
        setBusy(false)
        return
      }
      window.location.href = j.url // full-page redirect to Google consent
    } catch {
      toast.error('Could not start Google connection')
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      const r = await authedFetch('/api/google/disconnect', { method: 'POST' })
      if (r.ok) {
        toast.success('Disconnected Google Calendar')
        await load()
        onChange?.()
      } else {
        toast.error('Failed to disconnect')
      }
    } catch {
      toast.error('Failed to disconnect')
    }
    setBusy(false)
  }

  if (!status) return null

  if (!status.configured) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-text3">
        <CalIcon size={13} strokeWidth={2} /> Google Calendar not configured
      </div>
    )
  }

  if (status.connected) {
    return (
      <div>
        <div className="flex items-center gap-2 text-[12px] text-text2">
          <CalIcon size={13} strokeWidth={2} className="text-accent shrink-0" />
          <span className="truncate" title={status.email ?? undefined}>
            Synced · {status.email}
          </span>
        </div>
        <button
          onClick={disconnect}
          disabled={busy}
          className="mt-1 text-[11px] text-text3 hover:text-accent3 transition-colors disabled:opacity-50"
        >
          {busy ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={connect}
      disabled={busy}
      className="inline-flex items-center gap-2 text-[12px] text-text2 hover:text-accent transition-colors disabled:opacity-50"
    >
      <CalIcon size={13} strokeWidth={2} />
      {busy ? 'Connecting…' : 'Connect Google Calendar'}
    </button>
  )
}
