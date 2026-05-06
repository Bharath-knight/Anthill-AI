'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Job = {
  id: string
  company: string
  role: string
  location: string | null
  deadline: string
  link: string
  status: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED'
  createdAt: string
}

const STATUS_OPTIONS = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const
const STATUS_COLORS: Record<string, string> = {
  SAVED: 'bg-gray-100 text-gray-600',
  APPLIED: 'bg-blue-50 text-blue-700',
  INTERVIEW: 'bg-yellow-50 text-yellow-700',
  OFFER: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-600',
}

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  function token() { return localStorage.getItem('anthill_token') }

  async function fetchJobs() {
    const tk = token()
    if (!tk) { router.replace('/login'); return }
    const res = await fetch('/api/jobs', { headers: { Authorization: `Bearer ${tk}` } })
    if (res.status === 401) { router.replace('/login'); return }
    setJobs(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchJobs() }, [])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: status as Job['status'] } : j))
  }

  async function deleteJob(id: string) {
    if (!confirm('Delete this job?')) return
    await fetch(`/api/jobs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    })
    setJobs(prev => prev.filter(j => j.id !== id))
  }

  const filtered = jobs.filter(j =>
    (!company || j.company.toLowerCase().includes(company.toLowerCase())) &&
    (!location || (j.location || '').toLowerCase().includes(location.toLowerCase())) &&
    (!statusFilter || j.status === statusFilter)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Jobs</h2>
          <p className="text-sm text-gray-400 mt-0.5">Captured from the extension</p>
        </div>
        <span className="text-sm text-gray-400">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <input
          placeholder="Filter company"
          value={company}
          onChange={e => setCompany(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
        />
        <input
          placeholder="Filter location"
          value={location}
          onChange={e => setLocation(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No jobs yet.</p>
          <p className="text-xs mt-1">Use the Chrome extension to capture job postings.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Company', 'Role', 'Location', 'Deadline', 'Status', 'Link', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(job => (
                <tr key={job.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{job.company}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{job.role}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{job.location || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{job.deadline}</td>
                  <td className="px-4 py-3">
                    <select
                      value={job.status}
                      onChange={e => updateStatus(job.id, e.target.value)}
                      className={`text-xs rounded-full px-2.5 py-1 font-medium cursor-pointer border-0 ${STATUS_COLORS[job.status]}`}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <a href={job.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline">
                      Open ↗
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteJob(job.id)}
                      className="text-xs text-gray-300 hover:text-red-500 transition-colors">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
