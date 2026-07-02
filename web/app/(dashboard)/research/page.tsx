'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, LayoutGrid, List, Plus, Wand2, X } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ResearchLibraryCard } from '@/components/ResearchLibraryCard'
import { ResearchStats } from '@/components/ResearchStats'
import { AddSourceModal } from '@/components/AddSourceModal'
import { getToken, authedFetch } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import {
  dateBucket, DATE_BUCKET_ORDER, displayTitle, TYPE_FILTERS,
  notifyCollectionsChanged, COLLECTIONS_CHANGED_EVENT,
  type ResearchItem, type CollectionSummary, type DateBucket,
} from '@/lib/research-display'

type Sort = 'recent' | 'oldest' | 'az'

function typeMatches(item: ResearchItem, key: string): boolean {
  if (key === 'all') return true
  if (key === 'webpage') return !item.contentType || item.contentType === 'webpage'
  return item.contentType === key
}

function ResearchLibrary() {
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()
  const collectionFilter = params.get('collection')

  const [items, setItems] = useState<ResearchItem[]>([])
  const [collections, setCollections] = useState<CollectionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    const res = await authedFetch('/api/research')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  const fetchCollections = useCallback(async () => {
    const res = await authedFetch('/api/collections')
    if (res.ok) setCollections(await res.json())
  }, [])

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return }
    fetchItems()
    fetchCollections()
  }, [fetchItems, fetchCollections, router])

  // Keep the collection dropdown fresh when the sidebar creates/deletes one.
  useEffect(() => {
    const onChange = () => fetchCollections()
    window.addEventListener(COLLECTIONS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(COLLECTIONS_CHANGED_EVENT, onChange)
  }, [fetchCollections])

  const activeCollection = collections.find((c) => c.id === collectionFilter) || null

  async function runMatching() {
    setRunning(true)
    const res = await authedFetch('/api/match/run', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) toast.success(`Found ${data.matched ?? 0} match${data.matched !== 1 ? 'es' : ''}`)
    await fetchItems()
    setRunning(false)
  }

  async function onMove(itemId: string, collectionId: string | null) {
    const target = collectionId ? collections.find((c) => c.id === collectionId) ?? null : null
    setItems((prev) => prev.map((it) => it.id === itemId
      ? { ...it, collectionId, collection: target ? { id: target.id, name: target.name, color: target.color } : null }
      : it))
    const res = await authedFetch(`/api/research/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ collectionId }),
    })
    if (!res.ok) { toast.error('Could not move source'); fetchItems() }
    else notifyCollectionsChanged()
  }

  async function onDelete(itemId: string) {
    const prev = items
    setItems((cur) => cur.filter((it) => it.id !== itemId))
    const res = await authedFetch(`/api/research/${itemId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Could not delete source'); setItems(prev) }
    else notifyCollectionsChanged()
  }

  async function onUpdateMatch(matchId: string, status: 'ACCEPTED' | 'REJECTED') {
    await authedFetch(`/api/match/${matchId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    setItems((prev) => prev.map((it) => ({
      ...it,
      matches: it.matches.map((m) => (m.id === matchId ? { ...m, status } : m)),
    })))
  }

  // Filter pipeline: collection → search/tag → (type counts computed here) → type.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((it) => {
      if (collectionFilter && it.collectionId !== collectionFilter) return false
      if (activeTag && !(it.tags || []).some((t) => t.toLowerCase() === activeTag.toLowerCase())) return false
      if (q) {
        const hay = [it.title, it.summary, it.domain, it.content, (it.tags || []).join(' ')]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, collectionFilter, activeTag, search])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of TYPE_FILTERS) counts[f.key] = scoped.filter((it) => typeMatches(it, f.key)).length
    return counts
  }, [scoped])

  const visible = useMemo(() => {
    const list = scoped.filter((it) => typeMatches(it, typeFilter))
    const sorted = [...list].sort((a, b) => {
      if (sort === 'az') return displayTitle(a).localeCompare(displayTitle(b))
      const da = new Date(a.createdAt).getTime(), db = new Date(b.createdAt).getTime()
      return sort === 'oldest' ? da - db : db - da
    })
    return sorted
  }, [scoped, typeFilter, sort])

  // Group by recency for the list view (date order only).
  const grouped = useMemo(() => {
    const groups = new Map<DateBucket, ResearchItem[]>()
    for (const it of visible) {
      const b = dateBucket(it.createdAt)
      if (!groups.has(b)) groups.set(b, [])
      groups.get(b)!.push(it)
    }
    return DATE_BUCKET_ORDER.filter((b) => groups.has(b)).map((b) => ({ bucket: b, items: groups.get(b)! }))
  }, [visible])

  const cardProps = { collections, onMove, onDelete, onUpdateMatch }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Research Library</h1>
          <p className="text-sm text-text2 mt-1">Everything you&apos;ve saved from across the web.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your research…"
              className="w-48 sm:w-64 rounded-md border border-border bg-surface pl-8 pr-3 py-2 text-sm text-text placeholder:text-text3 outline-none transition-colors focus:border-accent"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-sm text-text2 hover:text-text outline-none focus:border-accent cursor-pointer"
            title="Sort"
          >
            <option value="recent">Recently saved</option>
            <option value="oldest">Oldest first</option>
            <option value="az">Title A–Z</option>
          </select>
          <div className="hidden sm:flex items-center rounded-md border border-border bg-surface overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`p-2 transition-colors ${view === 'list' ? 'bg-surface3 text-text' : 'text-text3 hover:text-text'}`}
              title="List view" aria-label="List view"
            >
              <List size={15} strokeWidth={2} />
            </button>
            <button
              onClick={() => setView('grid')}
              className={`p-2 transition-colors ${view === 'grid' ? 'bg-surface3 text-text' : 'text-text3 hover:text-text'}`}
              title="Grid view" aria-label="Grid view"
            >
              <LayoutGrid size={15} strokeWidth={2} />
            </button>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent text-bg px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} strokeWidth={2.5} /> Add Source
          </button>
        </div>
      </div>

      {/* Active filters */}
      {(activeCollection || activeTag) && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {activeCollection && (
            <button
              onClick={() => router.push('/research')}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft text-accent px-2.5 py-1 text-xs font-medium"
            >
              {activeCollection.name}
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface2 text-text2 px-2.5 py-1 text-xs font-medium hover:text-text"
            >
              #{activeTag}
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}

      {/* Type tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TYPE_FILTERS.map((f) => {
          const active = typeFilter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text2 hover:bg-surface3 hover:text-text'
              }`}
            >
              {f.label}
              <span className={active ? 'text-accent' : 'text-text3'}>{typeCounts[f.key] ?? 0}</span>
            </button>
          )
        })}
        <button
          onClick={runMatching}
          disabled={running}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text2 hover:text-text hover:bg-surface3 disabled:opacity-50 transition-colors"
          title="Match research against your tasks"
        >
          <Wand2 size={13} strokeWidth={2} /> {running ? 'Matching…' : 'Run matching'}
        </button>
      </div>

      {/* Stats */}
      {!loading && items.length > 0 && (
        <ResearchStats items={items} collectionsCount={collections.length} onTopicClick={(t) => setActiveTag(t)} />
      )}

      {/* Body */}
      {loading ? (
        <p className="text-sm text-text3">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search size={32} strokeWidth={1.5} />}
          title="No research yet"
          subtitle="Click “Add Source” or use the extension to save anything from the web."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Search size={32} strokeWidth={1.5} />}
          title="Nothing matches"
          subtitle="Try a different filter, type, or search term."
        />
      ) : view === 'grid' || sort === 'az' ? (
        <div className={view === 'grid' ? 'grid grid-cols-1 xl:grid-cols-2 gap-3' : 'space-y-3'}>
          {visible.map((it) => (
            <ResearchLibraryCard key={it.id} item={it} {...cardProps} />
          ))}
        </div>
      ) : (
        <div className="space-y-7">
          {grouped.map(({ bucket, items: bucketItems }) => (
            <div key={bucket}>
              <div className="text-[11px] font-medium uppercase tracking-wide text-text3 mb-2">{bucket}</div>
              <div className="space-y-3">
                {bucketItems.map((it) => (
                  <ResearchLibraryCard key={it.id} item={it} {...cardProps} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddSourceModal open={addOpen} onClose={() => setAddOpen(false)} onCaptured={() => { fetchItems(); notifyCollectionsChanged() }} />
    </div>
  )
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-text3">Loading…</p>}>
      <ResearchLibrary />
    </Suspense>
  )
}
