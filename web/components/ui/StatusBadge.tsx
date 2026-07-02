type Status = 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED'

export const STATUS_OPTIONS: Status[] = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED']

const COLORS: Record<Status, string> = {
  SAVED: 'text-text2 bg-surface3',
  APPLIED: 'text-accent2 bg-accent2-soft',
  INTERVIEW: 'text-warn bg-[rgba(240,160,48,0.12)]',
  OFFER: 'text-accent bg-accent-soft',
  REJECTED: 'text-accent3 bg-[rgba(255,107,122,0.12)]',
}

export function StatusSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const color = COLORS[(value as Status) ?? 'SAVED'] ?? COLORS.SAVED
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`appearance-none cursor-pointer text-[11px] font-semibold rounded-full px-2.5 py-1 border-0 outline-none focus:ring-1 focus:ring-border2 ${color}`}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s} className="bg-surface text-text">
          {s}
        </option>
      ))}
    </select>
  )
}
