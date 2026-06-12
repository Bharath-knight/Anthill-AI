import { ArrowUpRight } from 'lucide-react'
import { Tag, TypeDot } from './Tag'

export type ResearchItem = {
  id: string
  content: string
  sourceUrl: string | null
  domain: string | null
  createdAt: string
}

export function ResearchCard({ item }: { item: ResearchItem }) {
  return (
    <div className="group glass-pane bg-surface border border-border rounded-lg p-4 transition-colors duration-150 hover:border-border2">
      <div className="flex items-start gap-3">
        <div className="pt-1.5">
          <TypeDot color="accent2" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {item.domain && <Tag variant="accent2">{item.domain}</Tag>}
            <span className="text-[11px] text-text3">
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-text2 hover:text-accent2 transition-colors ml-auto"
              >
                <ArrowUpRight size={11} strokeWidth={2.25} /> Source
              </a>
            )}
          </div>
          <p className="text-sm text-text2 leading-relaxed line-clamp-3">{item.content}</p>
        </div>
      </div>
    </div>
  )
}
