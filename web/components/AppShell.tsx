'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  Search, Plus, Sun, CalendarDays, Calendar, Inbox, CheckCircle2, ArrowUpRight,
  Layers, Briefcase, FileText, Folder, Settings, LogOut, LogIn, PanelLeft, ListTodo,
} from 'lucide-react'
import { SettingsModal } from '@/components/SettingsModal'
import type { TaskView } from '@/lib/tasks/smart-date'
import { setTaskView, useTaskView, requestNewTask } from '@/lib/tasks/task-view'
import { authedFetch } from '@/lib/auth/api-client'
import { bootstrapSession, clearSession, getStoredUser, getToken, updateStoredUser } from '@/lib/auth/client-auth'
import { COLLECTIONS_CHANGED_EVENT, notifyCollectionsChanged, type CollectionSummary } from '@/lib/capture/research-display'

const SMART_LISTS: { view: TaskView; label: string; Icon: typeof Sun }[] = [
  { view: 'all', label: 'All', Icon: ListTodo },
  { view: 'today', label: 'Today', Icon: Sun },
  { view: 'next7', label: 'Next 7 Days', Icon: CalendarDays },
  { view: 'upcoming', label: 'Upcoming', Icon: Calendar },
  { view: 'nodate', label: 'No date', Icon: Inbox },
  { view: 'completed', label: 'Completed', Icon: CheckCircle2 },
]

const WORKSPACE: { href: string; label: string; Icon: typeof Sun }[] = [
  { href: '/items', label: 'Items', Icon: Layers },
  { href: '/jobs', label: 'Jobs', Icon: Briefcase },
  { href: '/research', label: 'Research', Icon: FileText },
  { href: '/calendar', label: 'Calendar', Icon: CalendarDays },
]

const COLLAPSE_KEY = 'anthill_sidebar_collapsed'

type SearchResults = {
  jobs: { id: string; company: string; role: string; link: string; status: string }[]
  tasks: {
    id: string
    title: string
    completed: boolean
    linkedJob: { id: string; company: string; role: string; link: string } | null
  }[]
  research: { id: string; content: string; domain: string | null; sourceUrl: string | null }[]
}

const EMPTY_RESULTS: SearchResults = { jobs: [], tasks: [], research: [] }

export function AppShell({ children, fullBleed = false }: { children: React.ReactNode; fullBleed?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<{ email: string; name?: string | null; hasPassword?: boolean } | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [collections, setCollections] = useState<CollectionSummary[]>([])
  const [creatingCollection, setCreatingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const currentView = useTaskView()

  useEffect(() => {
    setSignedIn(!!getToken())
    setUser(getStoredUser())
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
    bootstrapSession()
      .then((nextUser) => {
        setSignedIn(!!nextUser)
        if (nextUser) {
          setUser(nextUser)
          const shouldSetupPassword = new URLSearchParams(window.location.search).get('setupPassword') === '1'
          if (shouldSetupPassword) {
            setSettingsOpen(true)
            const url = new URL(window.location.href)
            url.searchParams.delete('setupPassword')
            window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
          }
        }
      })
      .catch(() => {})
  }, [])

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const q = searchTerm.trim()
    if (q.length < 2 || !signedIn) {
      setResults(EMPTY_RESULTS)
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(() => {
      authedFetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : EMPTY_RESULTS))
        .then((data) => {
          if (!cancelled) setResults(data)
        })
        .catch(() => {
          if (!cancelled) setResults(EMPTY_RESULTS)
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchTerm, signedIn])

  const loadCollections = useCallback(async () => {
    const res = await authedFetch('/api/collections')
    if (res.ok) setCollections(await res.json())
  }, [])

  // Load collections once signed in, and refetch whenever the library page mutates them.
  useEffect(() => {
    if (!signedIn) return
    loadCollections()
    const onChange = () => loadCollections()
    window.addEventListener(COLLECTIONS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(COLLECTIONS_CHANGED_EVENT, onChange)
  }, [signedIn, loadCollections])

  async function createCollection() {
    const name = newCollectionName.trim()
    if (!name) return
    const res = await authedFetch('/api/collections', { method: 'POST', body: JSON.stringify({ name }) })
    if (res.ok) {
      setNewCollectionName('')
      setCreatingCollection(false)
      await loadCollections()
      notifyCollectionsChanged()
    }
  }

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    clearSession()
    router.replace('/login')
  }

  const onTasks = pathname?.startsWith('/tasks') ?? false

  // Select a smart list, navigating to /tasks first if we're elsewhere.
  function goToView(v: TaskView) {
    setTaskView(v)
    if (!onTasks) router.push('/tasks')
    setMobileOpen(false)
  }

  const itemBase =
    'flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors duration-100'

  function NavLabel({ children }: { children: React.ReactNode }) {
    return <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{children}</span>
  }

  function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
      <div className={`px-2.5 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-text3 ${collapsed ? 'lg:hidden' : ''}`}>
        {children}
      </div>
    )
  }

  const resultCount = results.jobs.length + results.tasks.length + results.research.length

  function clearSearch() {
    setSearchTerm('')
    setResults(EMPTY_RESULTS)
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Mobile drawer scrim */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={`fixed lg:sticky top-0 z-40 lg:z-10 h-screen shrink-0 flex flex-col bg-surface2 border-r border-border2 overflow-y-auto
          transition-[width,transform] duration-200 w-64
          ${collapsed ? 'lg:w-16' : 'lg:w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-3 py-3">
          <Link href="/items" className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 shrink-0 rounded-md bg-accent text-bg grid place-items-center font-bold text-sm">A</span>
            <span className={`font-bold tracking-tight text-text truncate ${collapsed ? 'lg:hidden' : ''}`}>Anthill</span>
          </Link>
          <button
            onClick={toggleCollapse}
            className="hidden lg:grid ml-auto w-7 h-7 place-items-center rounded text-text3 hover:text-text hover:bg-surface3 transition-colors"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeft size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Search */}
        <div className="px-2">
          <div className={`relative ${collapsed ? 'lg:hidden' : ''}`}>
            <Search size={15} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search jobs, tasks, research"
              className="w-full rounded border border-border bg-surface px-8 py-1.5 text-sm text-text placeholder:text-text3 outline-none transition-colors focus:border-accent"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text3 hover:text-text"
                aria-label="Clear search"
              >
                x
              </button>
            )}
          </div>

          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className={`${itemBase} hidden lg:flex w-full text-text3 hover:bg-surface3 hover:text-text`}
              title="Search"
            >
              <Search size={16} strokeWidth={2} className="shrink-0" />
            </button>
          )}

          {searchTerm.trim().length >= 2 && !collapsed && (
            <div className="mt-2 rounded-md border border-border bg-surface p-2 shadow-sm">
              {searching && <p className="px-2 py-1.5 text-xs text-text3">Searching...</p>}
              {!searching && resultCount === 0 && (
                <p className="px-2 py-1.5 text-xs text-text3">No results found.</p>
              )}
              <SearchGroup label="Jobs" show={results.jobs.length > 0}>
                {results.jobs.map((job) => (
                  <SearchItem key={job.id} href="/jobs" onClick={clearSearch} icon={<Briefcase size={13} />}>
                    <span className="truncate">{job.company} - {job.role}</span>
                    <a
                      href={job.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto shrink-0 text-text3 hover:text-accent"
                      title="Open apply link"
                    >
                      <ArrowUpRight size={12} />
                    </a>
                  </SearchItem>
                ))}
              </SearchGroup>
              <SearchGroup label="Tasks" show={results.tasks.length > 0}>
                {results.tasks.map((task) => (
                  <SearchItem key={task.id} href="/tasks" onClick={clearSearch} icon={<ListTodo size={13} />}>
                    <span className="truncate">{task.title}</span>
                  </SearchItem>
                ))}
              </SearchGroup>
              <SearchGroup label="Research" show={results.research.length > 0}>
                {results.research.map((item) => (
                  <SearchItem key={item.id} href="/research" onClick={clearSearch} icon={<FileText size={13} />}>
                    <span className="truncate">{item.domain || item.content.slice(0, 48)}</span>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto shrink-0 text-text3 hover:text-accent"
                        title="Open source"
                      >
                        <ArrowUpRight size={12} />
                      </a>
                    )}
                  </SearchItem>
                ))}
              </SearchGroup>
            </div>
          )}
        </div>

        {/* Workspace — primary nav */}
        <SectionHeading>Workspace</SectionHeading>
        <nav className="px-2 flex flex-col gap-0.5">
          {WORKSPACE.map(({ href, label, Icon }) => {
            const active = pathname?.startsWith(href) ?? false
            return (
              <Link
                key={href}
                href={href}
                className={`${itemBase} ${active ? 'bg-surface3 text-text font-medium' : 'text-text2 hover:bg-surface3 hover:text-text'}`}
                title={label}
              >
                <Icon size={16} strokeWidth={2} className="shrink-0" />
                <NavLabel>{label}</NavLabel>
              </Link>
            )
          })}
        </nav>

        {/* Collections */}
        <div className="flex items-center justify-between pr-1.5">
          <SectionHeading>Collections</SectionHeading>
          {!collapsed && (
            <button
              onClick={() => setCreatingCollection((v) => !v)}
              className="mt-3 w-6 h-6 grid place-items-center rounded text-text3 hover:text-text hover:bg-surface3 transition-colors"
              aria-label="New collection"
              title="New collection"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
        <nav className={`px-2 flex flex-col gap-0.5 ${collapsed ? 'lg:hidden' : ''}`}>
          {creatingCollection && (
            <input
              autoFocus
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createCollection()
                if (e.key === 'Escape') { setCreatingCollection(false); setNewCollectionName('') }
              }}
              onBlur={() => { if (!newCollectionName.trim()) setCreatingCollection(false) }}
              placeholder="Collection name…"
              className="mb-1 rounded border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text3 outline-none focus:border-accent"
            />
          )}
          {collections.length === 0 && !creatingCollection ? (
            <p className="px-2.5 py-1 text-[11px] text-text3">No collections yet.</p>
          ) : (
            collections.map((c) => (
              <Link
                key={c.id}
                href={`/research?collection=${c.id}`}
                className={`${itemBase} justify-between text-text2 hover:bg-surface3 hover:text-text`}
                title={c.name}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {c.color
                    ? <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: c.color }} />
                    : <Folder size={16} strokeWidth={2} className="shrink-0" />}
                  <NavLabel>{c.name}</NavLabel>
                </span>
                <span className="text-[11px] text-text3">{c.count}</span>
              </Link>
            ))
          )}
        </nav>

        <div className={`mx-3 my-2 border-t border-border ${collapsed ? 'lg:hidden' : ''}`} />

        {/* Tasks — smart lists */}
        <SectionHeading>Tasks</SectionHeading>
        <nav className="px-2 flex flex-col gap-0.5">
          <button
            onClick={() => {
              if (currentView === 'completed') setTaskView('all')
              if (!onTasks) router.push('/tasks')
              requestNewTask()
              setMobileOpen(false)
            }}
            className={`${itemBase} w-full text-left text-accent hover:bg-accent-soft font-medium`}
            title="New task"
          >
            <Plus size={16} strokeWidth={2.5} className="shrink-0" />
            <NavLabel>New task</NavLabel>
          </button>
          {SMART_LISTS.map(({ view, label, Icon }) => {
            const active = onTasks && currentView === view
            return (
              <button
                key={view}
                onClick={() => goToView(view)}
                className={`${itemBase} w-full text-left ${active ? 'bg-accent-soft text-accent font-medium' : 'text-text2 hover:bg-surface3 hover:text-text'}`}
                title={label}
              >
                <Icon size={16} strokeWidth={2} className="shrink-0" />
                <NavLabel>{label}</NavLabel>
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        {/* Footer */}
        <div className="px-2 py-2 border-t border-border flex flex-col gap-0.5">
          <button
            onClick={() => setSettingsOpen(true)}
            className={`${itemBase} text-text2 hover:bg-surface3 hover:text-text`}
            title="Appearance settings"
          >
            <Settings size={16} strokeWidth={2} className="shrink-0" />
            <NavLabel>Settings</NavLabel>
          </button>

          {signedIn ? (
            <button
              onClick={logout}
              className={`${itemBase} text-text2 hover:bg-surface3 hover:text-text`}
              title={user?.email}
            >
              <LogOut size={16} strokeWidth={2} className="shrink-0" />
              <NavLabel>{user?.name || user?.email || 'Sign out'}</NavLabel>
            </button>
          ) : (
            <Link href="/login" className={`${itemBase} text-text2 hover:bg-surface3 hover:text-text`} title="Sign in">
              <LogIn size={16} strokeWidth={2} className="shrink-0" />
              <NavLabel>Sign in</NavLabel>
            </Link>
          )}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 flex items-center gap-2 px-4 h-12 border-b border-border bg-surface">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-8 h-8 grid place-items-center rounded text-text2 hover:text-text hover:bg-surface3 transition-colors"
            aria-label="Open menu"
          >
            <PanelLeft size={16} strokeWidth={2} />
          </button>
          <Link href="/items" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-accent text-bg grid place-items-center font-bold text-xs">A</span>
            <span className="font-bold tracking-tight text-text text-sm">Anthill</span>
          </Link>
        </div>

        <main className="flex-1 min-w-0">
          {fullBleed ? children : <div className="max-w-6xl mx-auto px-6 py-8 lg:px-10">{children}</div>}
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        needsPassword={user?.hasPassword === false}
        onPasswordSaved={() => {
          const next = updateStoredUser({ hasPassword: true })
          if (next) setUser(next)
          else setUser((current) => current ? { ...current, hasPassword: true } : current)
        }}
      />
    </div>
  )
}

function SearchGroup({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null
  return (
    <div className="py-1">
      <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-text3">{label}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function SearchItem({
  href,
  onClick,
  icon,
  children,
}: {
  href: string
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  function navigate() {
    onClick()
    window.location.href = href
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={navigate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate()
        }
      }}
      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-text2 hover:bg-surface3 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="shrink-0 text-text3">{icon}</span>
      {children}
    </div>
  )
}
