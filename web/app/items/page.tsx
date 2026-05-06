'use client'
import React, { useEffect, useState } from 'react'

type JobEvent = {
  id: string
  type: string
  fromStatus: string | null
  toStatus: string | null
  createdAt: string
}

type Job = {
  id: string
  company: string
  role: string
  location: string | null
  deadline: string
  link: string
  notes: string | null
  status: string
  createdAt: string
  events: JobEvent[]
}

type ResearchItem = {
  id: string
  content: string
  sourceUrl: string | null
  domain: string | null
  createdAt: string
}

type EditState = { company: string; role: string; location: string; deadline: string }

const STATUS_OPTIONS = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED']

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export default function ItemsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [research, setResearch] = useState<ResearchItem[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ company: '', role: '', location: '', deadline: '' })

  useEffect(() => {
    fetch('/api/items')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setJobs(data.jobs)
        setResearch(data.research)
      })
      .catch(() => setError('Failed to load items.'))
      .finally(() => setLoading(false))

    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return
        const counts: Record<string, number> = {}
        for (const t of data) {
          if (t.linkedJobId) counts[t.linkedJobId] = (counts[t.linkedJobId] ?? 0) + 1
        }
        setTaskCounts(counts)
      })
      .catch(() => {})
  }, [])

  function startEdit(job: Job) {
    setEditingId(job.id)
    setEditState({
      company: job.company,
      role: job.role,
      location: job.location ?? '',
      deadline: job.deadline,
    })
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: editState.company,
        role: editState.role,
        location: editState.location || null,
        deadline: editState.deadline,
      }),
    })
    if (!res.ok) return
    const updated = await res.json()
    setJobs(prev => prev.map(j => j.id === id ? updated : j))
    setEditingId(null)
  }

  async function deleteJob(id: string) {
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setJobs(prev => prev.filter(j => j.id !== id))
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  async function saveNotes(id: string, notes: string) {
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">Captured Items</h1>
          <p className="text-sm text-gray-400 mt-0.5">Everything captured from the extension</p>
        </div>
        <a href="/tasks" className="text-sm text-gray-500 hover:underline">Tasks →</a>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && (
        <>
          <section className="mb-10">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Jobs ({jobs.length})
            </h2>
            {jobs.length === 0 ? (
              <p className="text-sm text-gray-400">No jobs captured yet.</p>
            ) : (
              <div className="bg-white border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Company', 'Role', 'Location', 'Deadline', 'Status', 'Link', ''].map((h, i) => (
                        <th key={i} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {jobs.map(job => (
                      <React.Fragment key={job.id}>
                        <tr>
                          {editingId === job.id ? (
                            <>
                              <td className="px-4 py-2">
                                <input value={editState.company} onChange={e => setEditState(s => ({ ...s, company: e.target.value }))}
                                  className="border rounded px-2 py-1 text-xs w-full" />
                              </td>
                              <td className="px-4 py-2">
                                <input value={editState.role} onChange={e => setEditState(s => ({ ...s, role: e.target.value }))}
                                  className="border rounded px-2 py-1 text-xs w-full" />
                              </td>
                              <td className="px-4 py-2">
                                <input value={editState.location} onChange={e => setEditState(s => ({ ...s, location: e.target.value }))}
                                  className="border rounded px-2 py-1 text-xs w-full" />
                              </td>
                              <td className="px-4 py-2">
                                <input value={editState.deadline} onChange={e => setEditState(s => ({ ...s, deadline: e.target.value }))}
                                  className="border rounded px-2 py-1 text-xs w-full" />
                              </td>
                              <td className="px-4 py-2 text-gray-400 text-xs">{job.status}</td>
                              <td className="px-4 py-2">
                                <a href={job.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Open ↗</a>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <button onClick={() => saveEdit(job.id)} className="text-xs text-green-600 hover:underline mr-3">Save</button>
                                <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-medium">{job.company}</td>
                              <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{job.role}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{job.location || '—'}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs">{job.deadline}</td>
                              <td className="px-4 py-3">
                                <select
                                  value={job.status}
                                  onChange={e => {
                                    const status = e.target.value
                                    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status } : j))
                                    updateStatus(job.id, status)
                                  }}
                                  className="text-xs border rounded px-2 py-1 bg-white"
                                >
                                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <a href={job.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Open ↗</a>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <a href="/tasks" className="text-xs text-gray-400 hover:underline mr-3">
                                  {taskCounts[job.id] ? `${taskCounts[job.id]} task${taskCounts[job.id] > 1 ? 's' : ''}` : 'Tasks'}
                                </a>
                                <button onClick={() => startEdit(job)} className="text-xs text-gray-500 hover:underline mr-3">Edit</button>
                                <button onClick={() => deleteJob(job.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                              </td>
                            </>
                          )}
                        </tr>
                        <tr className="bg-gray-50/30">
                          <td colSpan={7} className="px-4 pb-3 pt-1">
                            <div className="flex gap-6">
                              <textarea
                                defaultValue={job.notes ?? ''}
                                onBlur={e => saveNotes(job.id, e.target.value)}
                                placeholder="Notes..."
                                rows={1}
                                className="flex-1 text-xs text-gray-600 border-0 bg-transparent resize-none focus:outline-none placeholder-gray-300"
                              />
                              {job.events.length > 0 && (
                                <div className="flex gap-3 items-center shrink-0">
                                  {job.events.map(ev => (
                                    <span key={ev.id} className="text-xs text-gray-400">
                                      {ev.toStatus} — {timeAgo(ev.createdAt)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Research ({research.length})
            </h2>
            {research.length === 0 ? (
              <p className="text-sm text-gray-400">No research captured yet.</p>
            ) : (
              <div className="space-y-2">
                {research.map(item => (
                  <div key={item.id} className="bg-white border rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{item.domain || item.sourceUrl || 'No source'}</span>
                      {item.sourceUrl && (
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline">
                          Open ↗
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
