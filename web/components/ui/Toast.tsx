'use client'
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type Variant = 'success' | 'error' | 'info'

type Toast = {
  id: number
  title: string
  subtitle?: string
  variant: Variant
}

type ToastContextValue = {
  show: (toast: Omit<Toast, 'id'>) => void
  success: (title: string, subtitle?: string) => void
  error: (title: string, subtitle?: string) => void
  info: (title: string, subtitle?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TIMEOUT_MS = 4500

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback<ToastContextValue['show']>((t) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => dismiss(id), TIMEOUT_MS)
  }, [dismiss])

  const success = useCallback((title: string, subtitle?: string) => show({ title, subtitle, variant: 'success' }), [show])
  const error   = useCallback((title: string, subtitle?: string) => show({ title, subtitle, variant: 'error'   }), [show])
  const info    = useCallback((title: string, subtitle?: string) => show({ title, subtitle, variant: 'info'    }), [show])

  return (
    <ToastContext.Provider value={{ show, success, error, info }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = toast.variant === 'success' ? CheckCircle2 : toast.variant === 'error' ? AlertCircle : Info
  const accent =
    toast.variant === 'success' ? 'text-accent' :
    toast.variant === 'error' ? 'text-accent3' :
    'text-accent2'

  return (
    <div className="toast-enter pointer-events-auto glass-pane bg-surface border border-border rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 min-w-[280px]">
      <Icon size={18} className={`shrink-0 mt-0.5 ${accent}`} strokeWidth={2.25} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text">{toast.title}</div>
        {toast.subtitle && <div className="text-xs text-text2 mt-0.5">{toast.subtitle}</div>}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-text3 hover:text-text transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} strokeWidth={2.25} />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

// Optional no-op fallback so non-wrapped callers don't crash during SSR
export function useToastSafe(): ToastContextValue {
  const ctx = useContext(ToastContext)
  return ctx ?? { show: () => {}, success: () => {}, error: () => {}, info: () => {} }
}
