'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, ChevronDown, ChevronRight, Search, Filter, Check, Flag,
  Calendar as CalendarIcon, Clock, CheckCircle2, TrendingUp, ArrowRight,
  Lightbulb, Play, MoreHorizontal, Briefcase, FileText, User,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { TaskDetailPane } from '@/components/tasks/TaskDetailPane'
import type { Task } from '@/components/tasks/TaskRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { authedFetch, getToken } from '@/lib/auth/api-client'
import {
  pendingForView, completedForView, seedDeadlineForView, relativeLabel,
  type TaskView,
} from '@/lib/tasks/smart-date'
import { useTaskView, consumeFocusRequest, onNewTaskRequest } from '@/lib/tasks/task-view'
import { useRevalidate } from '@/lib/use-revalidate'

type Job = { id: string; company: string; role: string }

const VIEW_LABEL: Record<TaskView, string> = {
  all: 'All Tasks', today: 'Today', next7: 'Next 7 Days',
  upcoming: 'Upcoming', nodate: 'No date', completed: 'Completed',
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function isResearchTask(task: Task): boolean {
  if (task.linkedJobId) return false
  const text = `${task.title} ${task.description ?? ''}`.toLowerCase()
  return /\b(research|article|paper|read|reading|source|notes?|company intel|learn|study)\b/.test(text)
}

// Category tag + one-line source line, derived from the task's origin.
function taskCategory(task: Task): { cls: string; label: string; Icon: typeof Briefcase; sub: string } {
  if (task.linkedJob) {
    return { cls: 'tag-jobs', label: 'Jobs', Icon: Briefcase, sub: `${task.linkedJob.company} · ${task.linkedJob.role}` }
  }
  if (isResearchTask(task)) {
    return { cls: 'tag-research', label: 'Research', Icon: FileText, sub: 'Research' }
  }
  return { cls: 'tag-personal', label: 'Personal', Icon: User, sub: 'Personal' }
}

export default function TasksPage() {
  const router = useRouter()
  const toast = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [title, setTitle] = useState('')
  const [jobId, setJobId] = useState('')
  const view = useTaskView()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
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

  // Auto-sync: initial load + poll while visible + refetch on tab focus.
  useRevalidate(refresh)

  // "+New task" (sidebar) asks this page to open + focus the quick-add input.
  useEffect(() => {
    const focus = () => { setComposeOpen(true); requestAnimationFrame(() => addRef.current?.focus()) }
    const unsub = onNewTaskRequest(focus)
    if (consumeFocusRequest()) focus()
    return unsub
  }, [])

  async function addTask() {
    const t = title.trim()
    if (!t) return
    const res = await authedFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: t, linkedJobId: jobId || null, deadline: seedDeadlineForView(view) }),
    })
    if (!res.ok) { toast.error('Failed to add task'); return }
    const task = await res.json()
    setTasks((prev) => [task, ...prev])
    setTitle('')
    addRef.current?.focus()
  }

  async function patch(id: string, partial: Record<string, unknown>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...partial } : t)))
    const res = await authedFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(partial) })
    if (!res.ok) toast.error('Failed to save changes')
  }

  async function remove(id: string) {
    const prev = tasks
    setTasks((p) => p.filter((t) => t.id !== id))
    if (selectedId === id) setSelectedId(null)
    const res = await authedFetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) { setTasks(prev); toast.error('Failed to delete task') }
  }

  function openCompose() {
    setComposeOpen(true)
    requestAnimationFrame(() => addRef.current?.focus())
  }

  if (!authed) return null

  const pending = pendingForView(tasks, view)
  const done = completedForView(tasks, view)
  const selected = tasks.find((t) => t.id === selectedId) ?? null
  const label = VIEW_LABEL[view]

  return (
    <AppShell fullBleed>
      <main className="px-6 py-7 lg:px-9 lg:py-8 grid gap-7 items-start grid-cols-1 xl:grid-cols-[1fr_300px]">
        {/* ── Header ── */}
        <div className="xl:col-span-2 flex items-start justify-between gap-5 flex-wrap">
          <div>
            <h1 className="font-display text-[38px] leading-none font-semibold text-text">{label}</h1>
            <p className="text-text2 mt-2 text-[14.5px]">{greeting()} — let&apos;s get things done.</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-surface border border-border2 rounded-[11px] px-3.5 py-2.5 w-[260px] text-text2">
              <Search size={15} className="shrink-0" />
              <span className="text-[13.5px] truncate">Search tasks…</span>
            </div>
            <button className="inline-flex items-center gap-2 border border-border2 bg-surface rounded-[11px] px-3.5 py-2.5 text-[13.5px] font-medium text-text2 hover:bg-surface3 transition-colors">
              <Filter size={14} /> Filters
            </button>
            <button
              onClick={openCompose}
              className="inline-flex items-center gap-2 bg-accent text-white rounded-[11px] px-4 py-2.5 text-[13.5px] font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus size={16} strokeWidth={2.5} /> New task
            </button>
          </div>
        </div>

        {/* ── Left column ── */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Stats */}
          <section className="bg-surface border border-border rounded-[20px] p-6 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6">
            <Stat icon={<CheckCircle2 size={18} />} tint="si-1" num={pending.length} label="Open tasks"
              delta={<span className="inline-flex items-center gap-1 text-[var(--green-bar,#6E8B3D)]"><TrendingUp size={11} /> live</span>} />
            <Stat icon={<Clock size={18} />} tint="si-2" num="3.6h" label="Focus time"
              delta={<span className="text-text2">Daily goal: 4h</span>} />
            <Stat icon={<CheckCircle2 size={18} />} tint="si-3" num={done.length} label="Completed"
              delta={<span className="inline-flex items-center gap-1 text-[#6E8B3D]"><TrendingUp size={11} /> today</span>} />
            <Stat icon={<CalendarIcon size={18} />} tint="si-4" num={2} label="Events today"
              delta={<span className="text-[#6C5DAB] cursor-pointer" onClick={() => router.push('/calendar')}>View calendar</span>} />
          </section>

          {/* Task group */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-[12px] font-bold tracking-[0.06em] uppercase text-[#6E8B3D]">
              {label}
            </div>
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              {/* compose row */}
              {composeOpen && view !== 'completed' && (
                <div className="flex items-center gap-3.5 px-5 py-3.5 border-b border-border bg-surface3/40">
                  <span className="w-5 h-5 rounded-md border-[1.8px] border-dashed border-[#CFCDC2] shrink-0" />
                  <input
                    ref={addRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addTask()
                      if (e.key === 'Escape') { setComposeOpen(false); setTitle('') }
                    }}
                    placeholder="What needs to get done?"
                    className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-medium text-text placeholder:text-text3"
                  />
                  {jobs.length > 0 && (
                    <select
                      value={jobId}
                      onChange={(e) => setJobId(e.target.value)}
                      className="shrink-0 max-w-[150px] border border-border2 rounded-lg px-2.5 py-1.5 text-xs text-text2 bg-surface cursor-pointer outline-none"
                      title="Link a job"
                    >
                      <option value="">No job</option>
                      {jobs.map((j) => <option key={j.id} value={j.id}>{j.company} — {j.role}</option>)}
                    </select>
                  )}
                  <button onClick={addTask} disabled={!title.trim()}
                    className="shrink-0 bg-accent text-white rounded-lg px-4 py-2 text-[13px] font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity">
                    Add
                  </button>
                </div>
              )}

              {loading && <div className="px-5 py-6 text-sm text-text3">Loading…</div>}

              {!loading && pending.length === 0 && done.length === 0 && (
                <div className="py-4">
                  <EmptyState icon={<CheckCircle2 size={30} strokeWidth={1.5} />} title={`Nothing in ${label}`} subtitle="Add a task above to get going." />
                </div>
              )}

              {!loading && view !== 'completed' && pending.map((task) => (
                <TaskLine key={task.id} task={task} onToggle={() => patch(task.id, { completed: true })} onOpen={() => setSelectedId(task.id)} />
              ))}

              {/* completed (collapsible) */}
              {!loading && done.length > 0 && (
                <>
                  <button
                    onClick={() => setCompletedOpen((o) => !o)}
                    className="flex items-center gap-1.5 w-full px-5 py-3 text-xs font-semibold text-text2 hover:text-text border-t border-border transition-colors"
                  >
                    {completedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Completed ({done.length})
                  </button>
                  {completedOpen && done.map((task) => (
                    <TaskLine key={task.id} task={task} done onToggle={() => patch(task.id, { completed: false })} onOpen={() => setSelectedId(task.id)} />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right rail (placeholders per mockup) ── */}
        <aside className="hidden xl:flex flex-col gap-5 sticky top-7">
          <div className="bg-surface border border-border rounded-[18px] p-6">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.07em] text-text3 mb-4">FOCUS <MoreHorizontal size={16} /></div>
            <div className="flex items-center gap-4 mb-5">
              <div className="relative w-[74px] h-[74px] shrink-0">
                <svg width="74" height="74" viewBox="0 0 74 74" className="-rotate-90">
                  <circle cx="37" cy="37" r="31" fill="none" stroke="var(--border)" strokeWidth="7" />
                  <circle cx="37" cy="37" r="31" fill="none" stroke="#6E8B3D" strokeWidth="7" strokeLinecap="round" strokeDasharray="194.8" strokeDashoffset="54.5" />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-base font-bold text-text">72%</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-text mb-1">Great progress!</div>
                <div className="text-[12.5px] text-text2 leading-snug">You&apos;re on track to hit your daily goal.</div>
              </div>
            </div>
            <button className="w-full flex items-center justify-center gap-2 bg-surface3 rounded-[11px] py-3 text-[13.5px] font-semibold text-text hover:brightness-95 transition">
              <Play size={15} fill="currentColor" /> Start focus session
            </button>
          </div>

          <div className="bg-surface border border-border rounded-[18px] p-6">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.07em] text-text3 mb-4">SMART SUGGESTIONS <MoreHorizontal size={16} /></div>
            {[
              { Icon: Lightbulb, text: `You have ${pending.length} open task${pending.length !== 1 ? 's' : ''}`, cta: 'Review' },
              { Icon: CheckCircle2, text: 'Similar tasks can be grouped', cta: 'Review' },
              { Icon: Clock, text: 'Focus usually drops at 3 PM', cta: 'Schedule break' },
            ].map((s, i) => (
              <div key={i} className="flex gap-3 mb-4 last:mb-0">
                <div className="w-8 h-8 rounded-[10px] bg-surface3 text-text2 grid place-items-center shrink-0"><s.Icon size={16} /></div>
                <div>
                  <div className="text-[13px] text-text2 leading-snug mb-1">{s.text}</div>
                  <div className="text-[13px] font-semibold text-[#6E8B3D] inline-flex items-center gap-1 cursor-pointer">{s.cta} <ArrowRight size={12} /></div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>

      <TaskDetailPane task={selected} onClose={() => setSelectedId(null)} onPatch={patch} onDelete={remove} />
    </AppShell>
  )
}

function Stat({ icon, tint, num, label, delta }: {
  icon: React.ReactNode; tint: string; num: React.ReactNode; label: string; delta: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className={`stat-ico ${tint} mb-4`}>{icon}</div>
      <div className="text-[28px] font-bold leading-none tracking-tight text-text">{num}</div>
      <div className="text-[13.5px] text-text2 mt-2 mb-1.5">{label}</div>
      <div className="text-[12.5px] font-semibold">{delta}</div>
    </div>
  )
}

function TaskLine({ task, done, onToggle, onOpen }: {
  task: Task; done?: boolean; onToggle: () => void; onOpen: () => void
}) {
  const cat = taskCategory(task)
  const due = task.deadline ? relativeLabel(task.deadline) : ''
  return (
    <div className={`flex items-center gap-3.5 px-5 py-4 border-b border-border last:border-b-0 hover:bg-surface3/40 transition-colors ${done ? 'opacity-60' : ''}`}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className={`w-5 h-5 rounded-md border-[1.8px] grid place-items-center shrink-0 transition-colors ${done ? 'bg-accent border-accent text-white' : 'border-[#CFCDC2] bg-white hover:border-accent'}`}
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </button>
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div className={`text-[15px] font-semibold text-text ${done ? 'line-through text-text3' : ''}`}>{task.title}</div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-text2 mt-0.5">
          <cat.Icon size={13} className="shrink-0" /> <span className="truncate">{cat.sub}</span>
        </div>
      </button>
      <span className={`tag-chip ${cat.cls} shrink-0`}>{cat.label}</span>
      {due && (
        <div className="hidden sm:flex items-center gap-1.5 text-[13px] text-text2 w-[130px] shrink-0">
          <CalendarIcon size={14} /> {due}
        </div>
      )}
      <span className={`shrink-0 ${done ? 'text-[#6E8B3D]' : 'text-[#C8C6BC]'}`}><Flag size={16} /></span>
    </div>
  )
}
