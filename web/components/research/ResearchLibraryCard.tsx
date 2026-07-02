'use client'
import { useState } from 'react'
import {
  ExternalLink, Trash2, Sparkles, Folder, ChevronDown, Link2,
  BookOpen, Code2, FileText, Globe, MessagesSquare, Newspaper, Package, PenLine, Video, BookMarked, AtSign,
  type LucideIcon,
} from 'lucide-react'
import { Tag } from '@/components/ui/Tag'
import {
  contentTypeLabel, displayTitle, faviconUrl, readingTimeMinutes, sourceName,
  formatSavedDate, contentSnippet,
  type ResearchItem, type CollectionSummary,
} from '@/lib/capture/research-display'

const TYPE_ICON: Record<string, LucideIcon> = {
  article: FileText, paper: BookOpen, video: Video, repo: Code2, docs: BookMarked,
  news: Newspaper, blog: PenLine, forum: MessagesSquare, social: AtSign, product: Package, webpage: Globe,
}

type Props = {
  item: ResearchItem
  collections: CollectionSummary[]
  onMove: (itemId: string, collectionId: string | null) => void
  onDelete: (itemId: string) => void
  onUpdateMatch: (matchId: string, status: 'ACCEPTED' | 'REJECTED') => void
}

// Favicon with a graceful fallback to a type icon when the image fails to load.
function SourceIcon({ item }: { item: ResearchItem }) {
  const [failed, setFailed] = useState(false)
  const src = faviconUrl(item)
  const Icon = TYPE_ICON[item.contentType ?? 'webpage'] ?? Globe
  return (
    <div className="w-9 h-9 shrink-0 rounded-md bg-surface2 border border-border grid place-items-center overflow-hidden">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={20} height={20} className="w-5 h-5 object-contain" onError={() => setFailed(true)} />
      ) : (
        <Icon size={16} strokeWidth={2} className="text-text3" />
      )}
    </div>
  )
}

export function ResearchLibraryCard({ item, collections, onMove, onDelete, onUpdateMatch }: Props) {
  const [showMatches, setShowMatches] = useState(false)
  const readMins = readingTimeMinutes(item.content)
  const summaryText = item.summary || contentSnippet(item.content)
  const bullets = item.bullets || []
  const tags = item.tags || []

  return (
    <div className="group relative glass-pane bg-surface border border-border rounded-lg p-4 transition-colors duration-150 hover:border-border2">
      {/* Delete (hover-revealed) */}
      <button
        onClick={() => {
          if (confirm('Delete this saved source? This cannot be undone.')) onDelete(item.id)
        }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-text3 hover:text-accent3 transition-all"
        aria-label="Delete source"
        title="Delete"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>

      <div className="flex items-start gap-3">
        <SourceIcon item={item} />

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-text3 mb-1 pr-6">
            <span className="font-medium text-text2 truncate max-w-[40%]">{sourceName(item.domain)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 text-text2">
              {(() => { const I = TYPE_ICON[item.contentType ?? 'webpage'] ?? Globe; return <I size={11} strokeWidth={2} /> })()}
              {contentTypeLabel(item.contentType)}
            </span>
            {readMins > 0 && (<><span aria-hidden>·</span><span>{readMins} min read</span></>)}
            <span aria-hidden>·</span>
            <span>{formatSavedDate(item.createdAt)}</span>
          </div>

          {/* Title */}
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group/title inline-flex items-start gap-1 text-[15px] font-semibold text-text leading-snug hover:text-accent transition-colors"
            >
              <span className="line-clamp-2">{displayTitle(item)}</span>
              <ExternalLink size={13} strokeWidth={2} className="mt-1 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity" />
            </a>
          ) : (
            <div className="text-[15px] font-semibold text-text leading-snug line-clamp-2">{displayTitle(item)}</div>
          )}

          {/* Summary */}
          {summaryText && (
            <p className="text-sm text-text2 leading-relaxed mt-1 line-clamp-2">{summaryText}</p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <Tag key={t} variant="accent2">{t}</Tag>
              ))}
            </div>
          )}

          {/* AI summary bullets */}
          {bullets.length > 0 && (
            <div className="mt-3 rounded-md bg-surface2 border border-border px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-text3 mb-1.5">
                <Sparkles size={12} strokeWidth={2} className="text-accent2" /> AI summary
              </div>
              <ul className="space-y-1">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-text2 leading-snug">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-accent2 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Matched tasks (existing feature, de-emphasized) */}
          {item.matches.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowMatches((s) => !s)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-text3 hover:text-text transition-colors"
              >
                <ChevronDown size={12} strokeWidth={2} className={`transition-transform ${showMatches ? '' : '-rotate-90'}`} />
                {item.matches.length} matched task{item.matches.length !== 1 ? 's' : ''}
              </button>
              {showMatches && (
                <div className="mt-2 space-y-1.5 pl-1">
                  {item.matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] text-text truncate">{m.task.title}</span>
                        <span className="text-[11px] text-text3 shrink-0">{Math.round(m.matchScore * 100)}%</span>
                      </div>
                      {m.status === 'PENDING' ? (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => onUpdateMatch(m.id, 'ACCEPTED')} className="text-xs text-accent hover:opacity-80 font-medium">Accept</button>
                          <button onClick={() => onUpdateMatch(m.id, 'REJECTED')} className="text-xs text-text3 hover:text-accent3">Reject</button>
                        </div>
                      ) : (
                        <Tag variant={m.status === 'ACCEPTED' ? 'accent' : 'default'}>{m.status}</Tag>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer: collection + open */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-text3 min-w-0">
              {item.collection?.color ? (
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: item.collection.color }} />
              ) : (
                <Folder size={12} strokeWidth={2} className="shrink-0" />
              )}
              <select
                value={item.collectionId ?? ''}
                onChange={(e) => onMove(item.id, e.target.value || null)}
                className="bg-transparent text-text2 hover:text-text cursor-pointer outline-none max-w-[160px]"
                title="Move to collection"
              >
                <option value="">No collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-text2 hover:text-accent transition-colors"
              >
                <Link2 size={12} strokeWidth={2} /> Open
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
