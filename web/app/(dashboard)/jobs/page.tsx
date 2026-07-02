'use client'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase } from 'lucide-react'
import { JobCard, type Job } from '@/components/jobs/JobCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextInput, Select } from '@/components/ui/Input'
import { STATUS_OPTIONS } from '@/components/ui/StatusBadge'
import { getToken } from '@/lib/auth/api-client'
import { useRevalidate } from '@/lib/use-revalidate'

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchJobs = useCallback(async () => {
    const tk = getToken()
    if (!tk) {
      router.replace('/login')
      return
    }
    const res = await fetch('/api/jobs', { headers: { Authorization: `Bearer ${tk}` } })
    if (res.status === 401) {
      router.replace('/login')
      return
    }
    setJobs(await res.json())
    setLoading(false)
  }, [router])

  // Auto-sync: refetch on mount, on interval, and when the tab regains focus.
  useRevalidate(fetchJobs)

  async function updateStatus(id: string, status: string) {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: status as Job['status'] } : j))
    )
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  async function deleteJob(id: string) {
    await fetch(`/api/jobs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }

  const filtered = jobs.filter(
    (j) =>
      (!company || j.company.toLowerCase().includes(company.toLowerCase())) &&
      (!location || (j.location || '').toLowerCase().includes(location.toLowerCase())) &&
      (!statusFilter || j.status === statusFilter)
  )

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-text2 mt-1">Captured from the extension.</p>
        </div>
        <span className="text-[11px] text-text3">
          {filtered.length} job{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <TextInput
          placeholder="Filter company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="sm:max-w-[180px]"
        />
        <TextInput
          placeholder="Filter location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="sm:max-w-[180px]"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:max-w-[160px]"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-text3">Loading...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={32} strokeWidth={1.5} />}
          title={jobs.length === 0 ? 'No jobs yet' : 'No matches'}
          subtitle={
            jobs.length === 0
              ? 'Use the Chrome extension to capture job postings.'
              : 'Try clearing the filters above.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onStatusChange={updateStatus}
              onDelete={deleteJob}
            />
          ))}
        </div>
      )}
    </div>
  )
}
