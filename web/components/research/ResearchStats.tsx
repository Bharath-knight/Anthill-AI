'use client'
import { Sparkles } from 'lucide-react'
import { readingTimeMinutes, topTopics, type ResearchItem } from '@/lib/capture/research-display'

type Props = {
  items: ResearchItem[]
  collectionsCount: number
  onTopicClick?: (tag: string) => void
}

export function ResearchStats({ items, collectionsCount, onTopicClick }: Props) {
  const total = items.length
  const totalMinutes = items.reduce((sum, it) => sum + readingTimeMinutes(it.content), 0)
  const savedTime = totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)}h` : `${totalMinutes}m`
  const enhanced = total ? Math.round((items.filter((i) => !!i.summary).length / total) * 100) : 0
  const topics = topTopics(items, 6)

  const stats: { label: string; value: string }[] = [
    { label: 'Total Sources', value: String(total) },
    { label: 'Collections', value: String(collectionsCount) },
    { label: 'Saved Time', value: savedTime },
    { label: 'AI Enhanced', value: `${enhanced}%` },
  ]

  return (
    <div className="glass-pane bg-surface border border-border rounded-lg px-5 py-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
        <div className="flex items-center gap-1.5 text-sm font-medium text-text shrink-0">
          <Sparkles size={15} strokeWidth={2} className="text-accent2" />
          Your Research at a Glance
        </div>

        <div className="flex flex-wrap gap-6">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-lg font-semibold tracking-tight text-text leading-none">{s.value}</div>
              <div className="text-[11px] text-text3 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {topics.length > 0 && (
          <div className="lg:ml-auto min-w-0">
            <div className="text-[11px] text-text3 mb-1.5">Top Topics</div>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((t) => (
                <button
                  key={t.tag}
                  onClick={() => onTopicClick?.(t.tag)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-border bg-surface2 text-text2 hover:text-text hover:border-border2 transition-colors"
                  title={`${t.count} source${t.count !== 1 ? 's' : ''}`}
                >
                  {t.tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
