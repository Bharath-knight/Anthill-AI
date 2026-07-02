'use client'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase, Search, Filter, ArrowUpDown, Plus, Check, Bookmark, Send, Clock,
  Calendar as CalendarIcon, FileText, ExternalLink, Building2, Bell, Trash2,
} from 'lucide-react'
import { type Job } from '@/components/jobs/JobCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { getToken } from '@/lib/auth/api-client'
import { useRevalidate } from '@/lib/use-revalidate'

const STATUSES = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const
const STATUS_PILL: Record<string, string> = {
  SAVED: 'st-saved', APPLIED: 'st-applied', INTERVIEW: 'st-interview', OFFER: 'st-offer', REJECTED: 'st-rejected',
}
const LOGO_COLORS = ['#5B8DB8', '#1C7A50', '#111111', '#B0703B', '#6C5DAB', '#B26B2C', '#556B2F']

function initials(company: string): string {
  const parts = company.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return LOGO_COLORS[h % LOGO_COLORS.length]
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  const days = Math.floor(d / 86400)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function hasRealDeadline(d: string): boolean {
  return !!d && d.toLowerCase() !== 'deadline not given' && d.toLowerCase() !== 'not specified'
}

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchJobs = useCallback(async () => {
    const tk = getToken()
    if (!tk) { router.replace('/login'); return }
    const res = await fetch('/api/jobs', { headers: { Authorization: `Bearer ${tk}` } })
    if (res.status === 401) { router.replace('/login'); return }
    setJobs(await res.json())
    setLoading(false)
  }, [router])

  useRevalidate(fetchJobs)

  async function updateStatus(id: string, status: string) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)))
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  async function deleteJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id))
    await fetch(`/api/jobs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs.filter((j) =>
      (!statusFilter || j.status === statusFilter) &&
      (!q || `${j.company} ${j.role} ${j.location ?? ''}`.toLowerCase().includes(q))
    )
  }, [jobs, query, statusFilter])

  const counts = useMemo(() => ({
    total: jobs.length,
    applied: jobs.filter((j) => j.status === 'APPLIED').length,
    saved: jobs.filter((j) => j.status === 'SAVED').length,
    interview: jobs.filter((j) => j.status === 'INTERVIEW').length,
  }), [jobs])

  const topCompanies = useMemo(() => {
    const map = new Map<string, number>()
    for (const j of jobs) map.set(j.company, (map.get(j.company) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name)
  }, [jobs])

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-5 flex-wrap mb-1">
        <h1 className="font-display text-[30px] font-semibold tracking-tight text-text">Jobs</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-surface border border-border2 rounded-[10px] px-3.5 py-2.5 w-[280px] text-text2">
            <Search size={15} className="shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs, companies, roles…"
              className="bg-transparent outline-none text-[13.5px] text-text placeholder:text-text2 w-full"
            />
          </div>
          <div className="relative inline-flex items-center gap-2 border border-border2 bg-surface rounded-[10px] px-3.5 py-2.5 text-[13.5px] font-medium text-text2">
            <Filter size={14} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-text2 pr-1"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <button
            onClick={() => router.push('/items')}
            className="inline-flex items-center gap-2 bg-accent text-white rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={16} strokeWidth={2.5} /> Add Job
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center text-text2 text-sm mt-1 mb-6">
        <span>Captured from the extension. We extract the details so you can apply faster.</span>
        <span className="text-[13px] text-text3 shrink-0">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Stats */}
      <section className="bg-surface border border-border rounded-[18px] px-7 py-6 flex items-center gap-6 flex-wrap mb-6">
        <JobStat icon={<Briefcase size={19} />} num={counts.total} label="Total Jobs" delta="all captured" />
        <span className="w-px self-stretch bg-border hidden sm:block" />
        <JobStat icon={<Send size={19} />} num={counts.applied} label="Applied" delta="in progress" />
        <span className="w-px self-stretch bg-border hidden sm:block" />
        <JobStat icon={<Bookmark size={19} />} num={counts.saved} label="Saved" delta="to review" />
        <span className="w-px self-stretch bg-border hidden sm:block" />
        <JobStat icon={<Clock size={19} />} num={counts.interview} label="Interviews" delta="scheduled" />

        {topCompanies.length > 0 && (
          <div className="ml-auto">
            <div className="text-[13px] font-semibold text-text2 mb-3">Top Companies</div>
            <div className="flex items-center">
              {topCompanies.map((c, i) => (
                <div
                  key={c}
                  title={c}
                  className="w-11 h-11 rounded-full grid place-items-center text-[10px] font-bold text-white overflow-hidden shadow-sm"
                  style={{ background: colorFor(c), border: '2.5px solid var(--surface)', marginLeft: i === 0 ? 0 : -10 }}
                >
                  {initials(c)}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Job cards */}
      {loading ? (
        <p className="text-sm text-text3">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={32} strokeWidth={1.5} />}
          title={jobs.length === 0 ? 'No jobs yet' : 'No matches'}
          subtitle={jobs.length === 0 ? 'Use the Chrome extension to capture job postings.' : 'Try clearing the search or filter.'}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((job) => (
            <JobRow key={job.id} job={job} onStatus={updateStatus} onDelete={deleteJob} />
          ))}
        </div>
      )}
    </div>
  )
}

function JobStat({ icon, num, label, delta }: { icon: React.ReactNode; num: number; label: string; delta: string }) {
  return (
    <div className="min-w-[110px]">
      <div className="text-text3 mb-3">{icon}</div>
      <div className="text-[26px] font-bold leading-none tracking-tight text-text">{num}</div>
      <div className="text-[13px] text-text2 mt-1.5 mb-1.5">{label}</div>
      <div className="text-[12px] font-semibold text-[#6E8B3D]">{delta}</div>
    </div>
  )
}

function JobRow({ job, onStatus, onDelete }: {
  job: Job; onStatus: (id: string, s: string) => void; onDelete: (id: string) => void
}) {
  return (
    <article className="bg-surface border border-border rounded-[18px] p-6 grid gap-7 relative grid-cols-1 lg:grid-cols-[minmax(280px,1.15fr)_minmax(200px,1fr)_150px]">
      {/* col 1 — identity */}
      <div className="flex gap-4">
        <div
          className="w-[64px] h-[64px] rounded-[12px] shrink-0 grid place-items-center text-white font-bold text-center leading-tight px-1"
          style={{ background: colorFor(job.company), fontSize: job.company.length > 10 ? 12 : 15 }}
        >
          {job.company.length > 14 ? initials(job.company) : job.company}
        </div>
        <div className="min-w-0">
          <h3 className="text-[18px] font-bold tracking-tight text-text mb-1.5 truncate">{job.role}</h3>
          <div className="text-[13px] text-text2 mb-3 truncate">
            {job.company}{job.location ? ` · ${job.location}` : ''} · Full-time
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <select
              value={job.status}
              onChange={(e) => onStatus(job.id, e.target.value)}
              className={`st-pill ${STATUS_PILL[job.status] ?? 'st-saved'} border-none outline-none cursor-pointer appearance-none pr-2`}
              title="Change status"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div className="flex gap-5 text-text3 text-[12.5px] flex-wrap">
            <span className="inline-flex items-center gap-1.5"><Bookmark size={13} /> Saved {timeAgo(job.createdAt)}</span>
            {job.status === 'APPLIED' && (
              <span className="inline-flex items-center gap-1.5"><Check size={13} /> Applied</span>
            )}
          </div>
        </div>
      </div>

      {/* col 2 — details */}
      <div className="lg:border-l lg:border-border lg:pl-7">
        <h4 className="text-[13.5px] font-semibold text-text mb-3.5">Job details</h4>
        <Detail icon={<CalendarIcon size={15} />} label="Application deadline"
          value={hasRealDeadline(job.deadline) ? job.deadline : 'Not specified'} />
        <Detail icon={<FileText size={15} />} label="Cover letter" value="Not specified" muted />
        <Detail icon={<Briefcase size={15} />} label="Experience needed" value="Not specified" muted />
      </div>

      {/* col 3 — actions */}
      <div className="flex flex-col gap-3.5 lg:pt-0.5">
        <a href={job.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[13.5px] text-text2 hover:text-accent transition-colors">
          <ExternalLink size={15} className="text-text3" /> View job
        </a>
        <a href={job.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[13.5px] text-text2 hover:text-accent transition-colors">
          <Building2 size={15} className="text-text3" /> Company
        </a>
        <button className="flex items-center gap-2.5 text-[13.5px] text-text2 hover:text-accent transition-colors text-left" title="Coming soon">
          <Bell size={15} className="text-text3" /> Set reminder
        </button>
        <button onClick={() => onDelete(job.id)} className="flex items-center gap-2.5 text-[13.5px] text-text2 hover:text-[#B0554F] transition-colors text-left">
          <Trash2 size={15} className="text-text3" /> Delete
        </button>
      </div>
    </article>
  )
}

function Detail({ icon, label, value, muted }: { icon: React.ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3 mb-3 last:mb-0">
      <div className="w-[30px] h-[30px] rounded-[9px] shrink-0 grid place-items-center bg-accent-soft text-accent">{icon}</div>
      <div>
        <div className="text-[11.5px] text-text2 leading-tight mb-0.5">{label}</div>
        <div className={`text-[13.5px] font-semibold ${muted ? 'text-text3' : 'text-text'}`}>{value}</div>
      </div>
    </div>
  )
}
