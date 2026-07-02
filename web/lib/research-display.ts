// Pure display helpers for the Research Library. No JSX — shared by the page
// (stats, grouping, filtering) and the card component.

export type ResearchMatch = {
  id: string
  matchScore: number
  matchedKeywords: string[]
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  task: { id: string; title: string }
}

export type ResearchCollectionRef = { id: string; name: string; color: string | null }

export type ResearchItem = {
  id: string
  content: string
  sourceUrl: string | null
  domain: string | null
  createdAt: string
  title: string | null
  summary: string | null
  bullets: string[]
  tags: string[]
  contentType: string | null
  favicon: string | null
  collectionId: string | null
  collection: ResearchCollectionRef | null
  matches: ResearchMatch[]
}

export type CollectionSummary = { id: string; name: string; color: string | null; count: number }

// Fired after any collection create/delete or item move so the sidebar and the
// library page can both refetch collections and stay in sync (decoupled).
export const COLLECTIONS_CHANGED_EVENT = 'anthill:collections-changed'

export function notifyCollectionsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(COLLECTIONS_CHANGED_EVENT))
}

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  article: 'Article',
  paper: 'Paper',
  video: 'Video',
  repo: 'Repository',
  docs: 'Docs',
  news: 'News',
  blog: 'Blog',
  forum: 'Forum',
  social: 'Social',
  product: 'Product',
  webpage: 'Webpage',
}

export function contentTypeLabel(type: string | null): string {
  if (!type) return 'Webpage'
  return CONTENT_TYPE_LABELS[type] ?? 'Webpage'
}

// ~200 wpm reading estimate from the stored page text. At least 1 minute.
export function readingTimeMinutes(content: string | null): number {
  if (!content) return 0
  const words = content.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return Math.max(1, Math.ceil(words / 200))
}

export function sourceName(domain: string | null): string {
  if (!domain) return 'Unknown source'
  return domain.replace(/^www\./, '')
}

export function displayTitle(item: ResearchItem): string {
  if (item.title && item.title.trim()) return item.title.trim()
  return sourceName(item.domain)
}

export function faviconUrl(item: Pick<ResearchItem, 'favicon' | 'domain'>): string | null {
  if (item.favicon) return item.favicon
  if (item.domain) return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.domain)}&sz=64`
  return null
}

// A one-line fallback preview from raw content, for items that predate enrichment.
export function contentSnippet(content: string | null, max = 160): string {
  if (!content) return ''
  const t = content.trim().replace(/\s+/g, ' ')
  return t.length > max ? t.slice(0, max).trimEnd() + '…' : t
}

export type DateBucket = 'Today' | 'Yesterday' | 'This Week' | 'Earlier'
export const DATE_BUCKET_ORDER: DateBucket[] = ['Today', 'Yesterday', 'This Week', 'Earlier']

export function dateBucket(iso: string): DateBucket {
  const d = new Date(iso).getTime()
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const DAY = 86_400_000
  if (d >= startOfToday) return 'Today'
  if (d >= startOfToday - DAY) return 'Yesterday'
  if (d >= startOfToday - 7 * DAY) return 'This Week'
  return 'Earlier'
}

export function formatSavedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// Top topics across items, by tag frequency.
export function topTopics(items: ResearchItem[], limit = 6): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const it of items) {
    for (const t of it.tags || []) {
      const key = t.trim()
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }))
}

// Content-type tabs shown above the list, with live counts.
export const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All Sources' },
  { key: 'article', label: 'Articles' },
  { key: 'paper', label: 'Papers' },
  { key: 'video', label: 'Videos' },
  { key: 'repo', label: 'Repos' },
  { key: 'docs', label: 'Docs' },
  { key: 'webpage', label: 'Pages' },
]
