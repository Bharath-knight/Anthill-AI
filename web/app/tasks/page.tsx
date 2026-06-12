'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight, ChevronDown, Sun, CalendarDays, Calendar, Inbox, CheckCircle2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { TaskRow, type Task } from '@/components/TaskRow'
import { TaskDetailPane } from '@/components/TaskDetailPane'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/Toast'
import { authedFetch, getToken } from '@/lib/api-client'
import {
  pendingForView, completedForView, seedDeadlineForView,
  type TaskView,
} from '@/lib/smart-date'

type Job = { id: string; company: string; role: string }

const VIEW_META: Record<TaskView, { label: string; Icon: typeof Sun; empty: string }> = {
  today:     { label: 'Today',       Icon: Sun,         empty: 'Nothing due today. Add a task to get going.' },
  next7:     { label: 'Next 7 Days', Icon: CalendarDays, empty: 'No tasks due in the next 7 days.' },
  upcoming:  { label: 'Upcoming',    Icon: Calendar,    empty: 'No upcoming tasks scheduled.' },
  nodate:    { label: 'No date',     Icon: Inbox,       empty: 'No undated tasks. This is your inbox.' },
  completed: { label: 'Completed',   Icon: CheckCircle2, empty: 'No completed tasks yet.' },
}
const VIEWS: TaskView[] = ['today', 'next7', 'upcoming', 'nodate', 'completed']

export default function TasksPage() {
  const router = useRouter()
  const toast = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [title, setTitle] = useState('')
  const [jobId, setJobId] = useState('')
  const [view, setView] = useState<TaskView>('today')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const addRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login')
      return
    }
    setAuthed(true)
    Promise.all([
      authedFetch('/api/tasks').then((r) => r.json()),
      authedFetch('/api/items').then((r) => r.json()),
    ])
      .then(([tasksData, itemsData]) => {
        setTasks(Array.isArray(tasksData) ? tasksData : [])
        setJobs(Array.isArray(itemsData?.jobs) ? itemsData.jobs : [])
      })
      .finally(() => setLoading(false))
  }, [router])

  // Active smart list is carried in the URL hash (set by the sidebar).
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1)
      setView(VIEWS.includes(h as TaskView) ? (h as TaskView) : 'today')
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  async function addTask() {
    const t = title.trim()
    if (!t) return
    const res = await authedFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: t,
        linkedJobId: jobId || null,
        deadline: seedDeadlineForView(view),
      }),
    })
    if (!res.ok) {
      toast.error('Failed to add task')
      return
    }
    const task = await res.json()
    setTasks((prev) => [task, ...prev])
    setTitle('')
    addRef.current?.focus()
  }

  // Optimistic per-field update shared by the row checkbox and the detail pane.
  async function patch(id: string, partial: Record<string, unknown>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...partial } : t)))
    const res = await authedFetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    })
    if (!res.ok) toast.error('Failed to save changes')
  }

  async function remove(id: string) {
    const prev = tasks
    setTasks((p) => p.filter((t) => t.id !== id))
    if (selectedId === id) setSelectedId(null)
    const res = await authedFetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setTasks(prev)
      toast.error('Failed to delete task')
    }
  }

  if (!authed) return null

  const meta = VIEW_META[view]
  const pending = pendingForView(tasks, view)
  const done = completedForView(tasks, view)
  const selected = tasks.find((t) => t.id === selectedId) ?? null
  const count = view === 'completed' ? done.length : pending.length

  return (
    <AppShell fullBleed>
      <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
        <header className="mb-5">
          <div className="flex items-center gap-2.5">
            <meta.Icon size={22} strokeWidth={2} className="text-accent" />
            <h1 className="text-xl font-semibold tracking-tight text-text">{meta.label}</h1>
          </div>
          <p className="text-sm text-text2 mt-1">
            {view === 'today' && (
              <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · </span>
            )}
            {count} task{count !== 1 ? 's' : ''}
          </p>
        </header>

        {view !== 'completed' && (
          <div className="flex items-center gap-2 px-3 py-2 mb-5 rounded-md border border-border bg-surface focus-within:border-accent transition-colors">
            <Plus size={16} strokeWidth={2.5} className="shrink-0 text-text3" />
            <input
              ref={addRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder={`Add task to "${meta.label}"…`}
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-text placeholder:text-text3"
            />
            {jobs.length > 0 && (
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="shrink-0 max-w-[150px] bg-transparent border-none outline-none text-xs text-text2 cursor-pointer"
                title="Link a job"
              >
                <option value="">No job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.company} — {j.role}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {loading && <p className="text-sm text-text3">Loading…</p>}

        {!loading && view === 'completed' && (
          done.length === 0 ? (
            <EmptyState icon={<meta.Icon size={32} strokeWidth={1.5} />} title="All clear" subtitle={meta.empty} />
          ) : (
            <div className="space-y-0.5 opacity-80">
              {done.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={task.id === selectedId}
                  onToggle={(id, c) => patch(id, { completed: c })}
                  onOpen={setSelectedId}
                  onDelete={remove}
                />
              ))}
            </div>
          )
        )}

        {!loading && view !== 'completed' && (
          <>
            {pending.length === 0 && done.length === 0 && (
              <EmptyState icon={<meta.Icon size={32} strokeWidth={1.5} />} title={`No tasks in ${meta.label}`} subtitle={meta.empty} />
            )}

            {pending.length > 0 && (
              <div className="space-y-0.5">
                {pending.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    selected={task.id === selectedId}
                    onToggle={(id, c) => patch(id, { completed: c })}
                    onOpen={setSelectedId}
                    onDelete={remove}
                  />
                ))}
              </div>
            )}

            {done.length > 0 && (
              <section className="mt-6">
                <button
                  onClick={() => setCompletedOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-xs font-medium text-text2 hover:text-text transition-colors mb-1"
                >
                  {completedOpen ? <ChevronDown size={14} strokeWidth={2.25} /> : <ChevronRight size={14} strokeWidth={2.25} />}
                  Completed ({done.length})
                </button>
                {completedOpen && (
                  <div className="space-y-0.5 opacity-70">
                    {done.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        selected={task.id === selectedId}
                        onToggle={(id, c) => patch(id, { completed: c })}
                        onOpen={setSelectedId}
                        onDelete={remove}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <TaskDetailPane
        task={selected}
        onClose={() => setSelectedId(null)}
        onPatch={patch}
        onDelete={remove}
      />
    </AppShell>
  )
}
