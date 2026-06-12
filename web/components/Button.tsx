import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-bg hover:opacity-90 disabled:bg-surface3 disabled:text-text3 disabled:opacity-100',
  secondary:
    'bg-surface2 text-text border border-border hover:border-border2 hover:bg-surface3 disabled:opacity-50',
  ghost:
    'bg-transparent text-text2 border border-transparent hover:bg-surface2 hover:text-text disabled:opacity-50',
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded px-3.5 py-2 transition-all duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
