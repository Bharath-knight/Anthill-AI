'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight, ChevronDown, Sun, CalendarDays, Calendar, Inbox, CheckCircle2, ListTodo, Briefcase, FileText } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { TaskRow, type Task } from '@/components/tasks/TaskRow'
import { TaskDetailPane } from '@/components/tasks/TaskDetailPane'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { authedFetch, getToken } from '@/lib/auth/api-client'
import type { LucideIcon } from 'lucide-react'
import {
  pendingForView, completedForView, seedDeadlineForView,
  type TaskView,
} from '@/lib/tasks/smart-date'
import { useTaskView, consumeFocusRequest, onNewTaskRequest } from '@/lib/tasks/task-view'
import { useRevalidate } from '@/lib/use-revalidate'

type Job = { id: string; company: string; role: string }
type TaskSourceFilter = 'all' | 'jobs' | 'research' | 'tasks'

const VIEW_META: Record<TaskView, { label: string; Icon: typeof Sun; empty: string }> = {
  all:       { label: 'All',         Icon: ListTodo,    empty: 'No tasks yet. Add one above to get started.' },
  today:     { label: 'Today',       Icon: Sun,         empty: 'Nothing due today. Add a task to get going.' },
  next7:     { label: 'Next 7 Days', Icon: CalendarDays, empty: 'No tasks due in the next 7 days.' },
  upcoming:  { label: 'Upcoming',    Icon: Calendar,    empty: 'No upcoming tasks scheduled.' },
  nodate:    { label: 'No date',     Icon: Inbox,       empty: 'No undated tasks. This is your inbox.' },
  completed: { label: 'Completed',   Icon: CheckCircle2, empty: 'No completed tasks yet.' },
}

const SOURCE_FILTERS: { value: TaskSourceFilter; label: string; Icon: LucideIcon }[] = [
  { value: 'all', label: 'All', Icon: ListTodo },
  { value: 'jobs', label: 'Jobs saved', Icon: Briefcase },
  { value: 'research', label: 'Research', Icon: FileText },
  { value: 'tasks', label: 'Tasks', Icon: CheckCircle2 },
]

function isResearchTask(task: Task): boolean {
  if (task.linkedJobId) return false
  const text = `${task.title} ${task.description ?? ''}`.toLowerCase()
  return /\b(research|article|paper|read|reading|source|notes?|company intel|learn|study)\b/.test(text)
}

function matchesSource(task: Task, source: TaskSourceFilter): boolean {
  if (source === 'all') return true
  if (source === 'jobs') return !!task.linkedJobId
  if (source === 'research') return isResearchTask(task)
  return !task.linkedJobId && !isResearchTask(task)
}

export default function TasksPage() {
  const router = useRouter()
  const toast = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [title, setTitle] = useState('')
  const [jobId, setJobId] = useState('')
  const [sourceFilter, setSourceFilter] = useState<TaskSourceFilter>('all')
  const view = useTaskView()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const addRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      router.replace('/login')
      return
    }
    setAuthed(true)
    try {
      const [tasksData, itemsData] = await Promise.all([
        authedFetch('/api/tasks').then((r) => r.json()),
        authedFetch('/api/items').then((r) => r.json()),
      ])
      setTasks(Array.isArray(tasksData) ? tasksData : [])
      setJobs(Array.isArray(itemsData?.jobs) ? itemsData.jobs : [])
    } finally {
      setLoading(false)
    }
  }, [router])

  // Auto-sync: initial load + poll while visible + refetch on tab focus, so links
  // saved from the extension appear without a manual refresh.
  useRevalidate(refresh)

  // "+New task" (sidebar) asks this page to focus the quick-add input.
  useEffect(() => {
    const focus = () => requestAnimationFrame(() => addRef.current?.focus())
    const unsub = onNewTaskRequest(focus)
    if (consumeFocusRequest()) focus()
    return unsub
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
  const pendingBase = pendingForView(tasks, view)
  const doneBase = completedForView(tasks, view)
  const sourcePool = view === 'completed' ? doneBase : [...pendingBase, ...doneBase]
  const sourceCounts = Object.fromEntries(
    SOURCE_FILTERS.map((f) => [f.value, sourcePool.filter((task) => matchesSource(task, f.value)).length])
  ) as Record<TaskSourceFilter, number>
  const pending = pendingBase.filter((task) => matchesSource(task, sourceFilter))
  const done = doneBase.filter((task) => matchesSource(task, sourceFilter))
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

        <div className="mb-5 flex flex-wrap gap-2">
          {SOURCE_FILTERS.map(({ value, label, Icon }) => {
            const active = sourceFilter === value
            return (
              <button
                key={value}
                onClick={() => setSourceFilter(value)}
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-surface text-text2 hover:bg-surface3 hover:text-text'
                }`}
              >
                <Icon size={13} strokeWidth={2.25} />
                {label}
                <span className={active ? 'text-accent' : 'text-text3'}>{sourceCounts[value]}</span>
              </button>
            )
          })}
        </div>

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
            <button
              onClick={addTask}
              disabled={!title.trim()}
              className="shrink-0 text-sm font-medium px-3 py-1 rounded bg-accent text-bg hover:opacity-90 disabled:bg-surface3 disabled:text-text3 transition-opacity"
            >
              Add
            </button>
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
