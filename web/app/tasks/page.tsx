'use client'
import { useEffect, useState } from 'react'
import { PlusIcon, Trash2Icon, CheckSquareIcon, LinkIcon, CalendarIcon } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Job = { id: string; company: string; role: string }
type Task = {
  id: string
  title: string
  completed: boolean
  deadline: string | null
  linkedJobId: string | null
  linkedJob: { id: string; company: string; role: string } | null
}

const NO_JOB = 'NONE'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [title, setTitle] = useState('')
  const [jobId, setJobId] = useState(NO_JOB)
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/items').then((r) => r.json()),
    ])
      .then(([tasksData, itemsData]) => {
        setTasks(Array.isArray(tasksData) ? tasksData : [])
        setJobs(Array.isArray(itemsData.jobs) ? itemsData.jobs : [])
      })
      .finally(() => setLoading(false))
  }, [])

  async function addTask() {
    if (!title.trim()) return
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        linkedJobId: jobId === NO_JOB ? null : jobId,
        deadline: deadline || null,
      }),
    })
    if (!res.ok) return
    const task = await res.json()
    setTasks((prev) => [task, ...prev])
    setTitle('')
    setJobId(NO_JOB)
    setDeadline('')
  }

  async function toggle(id: string, completed: boolean) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
    if (res.ok) setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)))
  }

  async function remove(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const pending = tasks.filter((t) => !t.completed)
  const done = tasks.filter((t) => t.completed)

  return (
    <AppShell title="Tasks" description={`${pending.length} remaining`}>
      <div className="mx-auto w-full max-w-2xl">
        {/* Add task */}
        <Card>
          <CardContent className="flex flex-col gap-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="Add a new task..."
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger className="sm:flex-1">
                  <SelectValue placeholder="No job linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NO_JOB}>No job linked</SelectItem>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.company} — {j.role}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="sm:w-44"
              />
              <Button onClick={addTask} disabled={!title.trim()}>
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lists */}
        <div className="mt-6">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckSquareIcon />
                </EmptyMedia>
                <EmptyTitle>No tasks yet</EmptyTitle>
                <EmptyDescription>
                  Add one above, or capture a job to generate follow-ups.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-6">
              {pending.length > 0 && (
                <section>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    To do · {pending.length}
                  </p>
                  <Card className="py-1">
                    <div className="flex flex-col">
                      {pending.map((task, i) => (
                        <div key={task.id}>
                          {i > 0 && <Separator />}
                          <TaskRow task={task} onToggle={toggle} onDelete={remove} />
                        </div>
                      ))}
                    </div>
                  </Card>
                </section>
              )}

              {done.length > 0 && (
                <section>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Completed · {done.length}
                  </p>
                  <Card className="py-1">
                    <div className="flex flex-col">
                      {done.map((task, i) => (
                        <div key={task.id}>
                          {i > 0 && <Separator />}
                          <TaskRow task={task} onToggle={toggle} onDelete={remove} />
                        </div>
                      ))}
                    </div>
                  </Card>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task
  onToggle: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <Checkbox
        checked={task.completed}
        onCheckedChange={(c) => onToggle(task.id, c === true)}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          className={cn(
            'truncate text-sm',
            task.completed ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {task.linkedJob && (
            <Badge variant="secondary" className="gap-1">
              <LinkIcon className="size-3" />
              {task.linkedJob.company}
            </Badge>
          )}
          {task.deadline && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarIcon className="size-3" />
              {new Date(task.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}
