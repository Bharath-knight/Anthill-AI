'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const STATUS_OPTIONS = [
  'SAVED',
  'APPLIED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
] as const

export type JobStatus = (typeof STATUS_OPTIONS)[number]

const STATUS_STYLES: Record<string, string> = {
  SAVED: 'bg-status-saved-bg text-status-saved',
  APPLIED: 'bg-status-applied-bg text-status-applied',
  INTERVIEW: 'bg-status-interview-bg text-status-interview',
  OFFER: 'bg-status-offer-bg text-status-offer',
  REJECTED: 'bg-status-rejected-bg text-status-rejected',
}

const STATUS_LABELS: Record<string, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_STYLES[status] ?? STATUS_STYLES.SAVED,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function StatusSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (status: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-7 w-[7.5rem] border-0 bg-transparent px-1.5 shadow-none hover:bg-secondary focus-visible:ring-1"
      >
        <SelectValue>
          <StatusBadge status={value} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              <StatusBadge status={s} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
