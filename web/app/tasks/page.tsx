'use client'
import { useEffect, useState } from 'react'

type Job = { id: string; company: string; role: string }
type Task = {
  id: string
  title: string
  completed: boolean
  deadline: string | null
  linkedJobId: string | null
  linkedJob: { id: string; company: string; role: string } | null
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [title, setTitle] = useState('')
  const [jobId, setJobId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/items').then(r => r.json()),
    ]).then(([tasksData, itemsData]) => {
      setTasks(Array.isArray(tasksData) ? tasksData : [])
      setJobs(Array.isArray(itemsData.jobs) ? itemsData.jobs : [])
    }).finally(() => setLoading(false))
  }, [])

  async function addTask() {
    if (!title.trim()) return
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        linkedJobId: jobId || null,
        deadline: deadline || null,
      }),
    })
    if (!res.ok) return
    const task = await res.json()
    setTasks(prev => [task, ...prev])
    setTitle('')
    setJobId('')
    setDeadline('')
  }

  async function toggle(id: string, completed: boolean) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
    if (res.ok) setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t))
  }

  async function remove(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) setTasks(prev => prev.filter(t => t.id !== id))
  }

  const pending = tasks.filter(t => !t.completed)
  const done = tasks.filter(t => t.completed)

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">{pending.length} remaining</p>
        </div>
        <a href="/items" className="text-sm text-gray-500 hover:underline">← Jobs</a>
      </div>

      {/* Add task form */}
      <div className="bg-white border rounded-lg p-4 mb-8 flex flex-col gap-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="New task..."
          className="text-sm border rounded px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
        <div className="flex gap-2">
          <select
            value={jobId}
            onChange={e => setJobId(e.target.value)}
            className="text-xs border rounded px-2 py-1.5 flex-1 bg-white text-gray-600"
          >
            <option value="">No job linked</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.company} — {j.role}</option>
            ))}
          </select>
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="text-xs border rounded px-2 py-1.5 text-gray-600"
          />
          <button
            onClick={addTask}
            className="text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-700"
          >
            Add
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading...</p>}

      {!loading && tasks.length === 0 && (
        <p className="text-sm text-gray-400">No tasks yet. Add one above or capture a job.</p>
      )}

      {!loading && pending.length > 0 && (
        <section className="mb-8">
          <div className="divide-y divide-gray-50">
            {pending.map(task => (
              <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={remove} />
            ))}
          </div>
        </section>
      )}

      {!loading && done.length > 0 && (
        <section>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Completed</p>
          <div className="divide-y divide-gray-50 opacity-60">
            {done.map(task => (
              <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={remove} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function TaskRow({ task, onToggle, onDelete }: {
  task: Task
  onToggle: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3 py-3 group">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={e => onToggle(task.id, e.target.checked)}
        className="shrink-0 w-4 h-4"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.completed ? 'line-through text-gray-300' : 'text-gray-800'}`}>
          {task.title}
        </p>
        {task.linkedJob && (
          <p className="text-xs text-gray-400 mt-0.5">
            {task.linkedJob.company} — {task.linkedJob.role}
          </p>
        )}
      </div>
      {task.deadline && (
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(task.deadline).toLocaleDateString()}
        </span>
      )}
      <button
        onClick={() => onDelete(task.id)}
        className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 shrink-0 text-base leading-none"
      >
        ×
      </button>
    </div>
  )
}