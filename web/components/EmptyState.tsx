import { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="text-3xl opacity-70 mb-3">{icon}</div>
      <div className="text-sm font-semibold text-text mb-1">{title}</div>
      {subtitle && <div className="text-xs text-text3 max-w-xs">{subtitle}</div>}
    </div>
  )
}
