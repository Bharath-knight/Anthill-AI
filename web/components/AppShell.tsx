'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Search, Plus, Sun, CalendarDays, Calendar, Inbox, CheckCircle2,
  Layers, Briefcase, FileText, Settings, LogOut, LogIn, PanelLeft, ListTodo,
} from 'lucide-react'
import { SettingsModal } from './SettingsModal'
import type { TaskView } from '@/lib/smart-date'
import { setTaskView, useTaskView, requestNewTask } from '@/lib/task-view'

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

export function AppShell({ children, fullBleed = false }: { children: React.ReactNode; fullBleed?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const currentView = useTaskView()

  useEffect(() => {
    setSignedIn(!!localStorage.getItem('anthill_token'))
    const stored = localStorage.getItem('anthill_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
  }, [])

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  function logout() {
    localStorage.removeItem('anthill_token')
    localStorage.removeItem('anthill_user')
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

        {/* Search (visual placeholder) */}
        <div className="px-2">
          <button
            className={`${itemBase} w-full text-text3 hover:bg-surface3 hover:text-text`}
            title="Search"
          >
            <Search size={16} strokeWidth={2} className="shrink-0" />
            <NavLabel>Search</NavLabel>
          </button>
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

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
