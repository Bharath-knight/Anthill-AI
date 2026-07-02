'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { PasteCapture, type Captured } from './PasteCapture'

type Props = {
  open: boolean
  onClose: () => void
  onCaptured: (c: Captured) => void
}

export function AddSourceModal({ open, onClose, onCaptured }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-24"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="glass-pane w-full max-w-lg bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="font-semibold text-text text-sm">Add a source</h3>
          <button onClick={onClose} className="text-text2 hover:text-text" aria-label="Close">
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
        <div className="px-4 pt-4">
          <p className="text-xs text-text3 mb-3">
            Paste any link — an article, paper, repo, video, or webpage. Anthill fetches it and turns it into a knowledge card.
          </p>
          <PasteCapture onCaptured={(c) => { onCaptured(c); onClose() }} />
        </div>
      </div>
    </div>
  )
}
