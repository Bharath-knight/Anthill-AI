import { ReactNode } from 'react'

type TagVariant = 'default' | 'accent' | 'accent2' | 'warn' | 'danger'

const VARIANT_CLASSES: Record<TagVariant, string> = {
  default: 'bg-surface3 text-text2 border-border2',
  accent: 'text-accent border-transparent',
  accent2: 'text-accent2 border-transparent',
  warn: 'text-warn border-transparent',
  danger: 'text-accent3 border-transparent',
}

const VARIANT_BG: Record<TagVariant, string> = {
  default: '',
  accent: 'bg-accent-soft',
  accent2: 'bg-accent2-soft',
  warn: 'bg-[rgba(240,160,48,0.12)]',
  danger: 'bg-[rgba(255,107,122,0.12)]',
}

export function Tag({
  children,
  variant = 'default',
}: {
  children: ReactNode
  variant?: TagVariant
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${VARIANT_CLASSES[variant]} ${VARIANT_BG[variant]}`}
    >
      {children}
    </span>
  )
}

export function TypeDot({ color = 'accent' }: { color?: 'accent' | 'accent2' | 'warn' | 'danger' }) {
  const bg = {
    accent: 'bg-accent',
    accent2: 'bg-accent2',
    warn: 'bg-warn',
    danger: 'bg-accent3',
  }[color]
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${bg}`} />
}
