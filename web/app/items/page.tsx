'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Search, X } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { JobCard, type Job } from '@/components/JobCard'
import { ResearchCard, type ResearchItem } from '@/components/ResearchCard'
import { EmptyState } from '@/components/EmptyState'
import { TextInput, FieldLabel } from '@/components/Input'
import { Button } from '@/components/Button'
import { PasteCapture, type Captured } from '@/components/PasteCapture'
import { useToast } from '@/components/Toast'
import { authedFetch, getToken } from '@/lib/api-client'

type EditState = { id: string; company: string; role: string; location: string; deadline: string }

export default function ItemsPage() {
  const router = useRouter()
  const toast = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [research, setResearch] = useState<ResearchItem[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login')
      return
    }
    setAuthed(true)

    authedFetch('/api/items')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          return
        }
        setJobs(data.jobs)
        setResearch(data.research)
      })
      .catch(() => setError('Failed to load items.'))
      .finally(() => setLoading(false))

    authedFetch('/api/tasks')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return
        const counts: Record<string, number> = {}
        for (const t of data) {
          if (t.linkedJobId) counts[t.linkedJobId] = (counts[t.linkedJobId] ?? 0) + 1
        }
        setTaskCounts(counts)
      })
      .catch(() => {})
  }, [router])

  async function saveEdit() {
    if (!edit) return
    const res = await authedFetch(`/api/jobs/${edit.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        company: edit.company,
        role: edit.role,
        location: edit.location || null,
        deadline: edit.deadline,
      }),
    })
    if (!res.ok) {
      toast.error('Failed to save job')
      return
    }
    const updated = await res.json()
    setJobs((prev) => prev.map((j) => (j.id === edit.id ? updated : j)))
    setEdit(null)
    toast.success('Saved')
  }

  async function deleteJob(id: string) {
    const res = await authedFetch(`/api/jobs/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete job')
      return
    }
    setJobs((prev) => prev.filter((j) => j.id !== id))
    toast.success('Deleted')
  }

  // Layer 4: one-click reclassify between Jobs and Research.
  async function moveJobToResearch(id: string) {
    const res = await authedFetch(`/api/jobs/${id}/reclassify`, { method: 'POST' })
    if (!res.ok) {
      toast.error('Failed to move to research')
      return
    }
    const item = await res.json()
    setJobs((prev) => prev.filter((j) => j.id !== id))
    setResearch((prev) => [item, ...prev.filter((r) => r.id !== item.id)])
    toast.success('Moved to research')
  }

  async function convertResearchToJob(id: string) {
    const res = await authedFetch(`/api/research/${id}/reclassify`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || 'Failed to convert to job')
      return
    }
    setResearch((prev) => prev.filter((r) => r.id !== id))
    setJobs((prev) => [data, ...prev.filter((j) => j.id !== data.id)])
    toast.success('Converted to job')
  }

  function handleCaptured(captured: Captured) {
    if (captured.type === 'job') {
      const job = captured.job
      setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)])
    } else {
      const item = captured.item
      setResearch((prev) => [item, ...prev.filter((r) => r.id !== item.id)])
    }
  }

  async function updateStatus(id: string, status: string) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)))
    await authedFetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async function saveNotes(id: string, notes: string) {
    await authedFetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    })
  }

  if (!authed) return null

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Captured items</h1>
          <p className="text-sm text-text2 mt-1">Paste a URL below or use the extension.</p>
        </div>
      </div>

      <PasteCapture onCaptured={handleCaptured} />

      {loading && <p className="text-sm text-text3">Loading...</p>}
      {error && <p className="text-sm text-accent3">{error}</p>}

      {!loading && !error && (
        <>
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-text3">
                Jobs
              </h2>
              <span className="text-[11px] text-text3">({jobs.length})</span>
            </div>

            {jobs.length === 0 ? (
              <EmptyState
                icon={<Briefcase size={32} strokeWidth={1.5} />}
                title="No jobs yet"
                subtitle="Use the Chrome extension to capture a job posting."
              />
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    taskCount={taskCounts[job.id]}
                    onStatusChange={updateStatus}
                    onNotesChange={saveNotes}
                    onDelete={deleteJob}
                    onReclassify={moveJobToResearch}
                    onEdit={(j) =>
                      setEdit({
                        id: j.id,
                        company: j.company,
                        role: j.role,
                        location: j.location ?? '',
                        deadline: j.deadline,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-text3">
                Research
              </h2>
              <span className="text-[11px] text-text3">({research.length})</span>
            </div>

            {research.length === 0 ? (
              <EmptyState
                icon={<Search size={32} strokeWidth={1.5} />}
                title="No research yet"
                subtitle="Save articles and research notes from the extension."
              />
            ) : (
              <div className="space-y-3">
                {research.map((item) => (
                  <ResearchCard key={item.id} item={item} onConvert={convertResearchToJob} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {edit && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEdit(null)
          }}
        >
          <div className="w-full max-w-md glass-pane bg-surface border border-border rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Edit job</h3>
              <button
                onClick={() => setEdit(null)}
                className="text-text2 hover:text-text"
                aria-label="Close"
              >
                <X size={16} strokeWidth={2.25} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel>Company</FieldLabel>
                <TextInput
                  value={edit.company}
                  onChange={(e) => setEdit({ ...edit, company: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel>Role</FieldLabel>
                <TextInput
                  value={edit.role}
                  onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel>Location</FieldLabel>
                <TextInput
                  value={edit.location}
                  onChange={(e) => setEdit({ ...edit, location: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel>Deadline</FieldLabel>
                <TextInput
                  value={edit.deadline}
                  onChange={(e) => setEdit({ ...edit, deadline: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveEdit}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
