'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ExternalLinkIcon,
  PencilIcon,
  Trash2Icon,
  BriefcaseIcon,
  SearchIcon,
  ListChecksIcon,
  Loader2Icon,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { StatusSelect, StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Field,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'

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

export default function ItemsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [research, setResearch] = useState<ResearchItem[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [editState, setEditState] = useState<EditState>({ company: '', role: '', location: '', deadline: '' })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/items')
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

    fetch('/api/tasks')
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
  }, [])

  function startEdit(job: Job) {
    setEditingJob(job)
    setEditState({
      company: job.company,
      role: job.role,
      location: job.location ?? '',
      deadline: job.deadline,
    })
  }

  async function saveEdit() {
    if (!editingJob) return
    const id = editingJob.id
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
    if (!res.ok) {
      toast.error('Could not save changes.')
      return
    }
    const updated = await res.json()
    setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)))
    setEditingJob(null)
    toast.success('Job updated.')
  }

  async function confirmDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/jobs/${deleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete job.')
      return
    }
    setJobs((prev) => prev.filter((j) => j.id !== deleteId))
    setDeleteId(null)
    toast.success('Job deleted.')
  }

  async function updateStatus(id: string, status: string) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)))
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

  const activeJobs = jobs.filter((j) => j.status !== 'REJECTED').length
  const interviews = jobs.filter((j) => j.status === 'INTERVIEW' || j.status === 'OFFER').length

  return (
    <AppShell
      title="Inbox"
      description="Everything captured from the extension"
    >
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={BriefcaseIcon} label="Jobs captured" value={jobs.length} loading={loading} />
        <StatCard icon={ListChecksIcon} label="Active" value={activeJobs} loading={loading} />
        <StatCard icon={BriefcaseIcon} label="Interview +" value={interviews} loading={loading} />
        <StatCard icon={SearchIcon} label="Research saved" value={research.length} loading={loading} />
      </div>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Jobs */}
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>{jobs.length} captured</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/jobs">Open jobs board</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="flex flex-col gap-3 px-6 pb-6">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="px-6 pb-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BriefcaseIcon />
                  </EmptyMedia>
                  <EmptyTitle>No jobs captured yet</EmptyTitle>
                  <EmptyDescription>
                    Use the Chrome extension to capture job postings as you browse.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Location</TableHead>
                    <TableHead className="hidden lg:table-cell">Deadline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id} className="align-top">
                      <TableCell className="font-medium">{job.company}</TableCell>
                      <TableCell className="max-w-[220px]">
                        <span className="block truncate">{job.role}</span>
                        {job.notes ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {job.notes}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {job.location || '—'}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                        {job.deadline || '—'}
                      </TableCell>
                      <TableCell>
                        <StatusSelect
                          value={job.status}
                          onChange={(s) => updateStatus(job.id, s)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          {taskCounts[job.id] ? (
                            <Button asChild variant="ghost" size="sm" className="h-8">
                              <Link href="/tasks">
                                <Badge variant="secondary">{taskCounts[job.id]}</Badge>
                                tasks
                              </Link>
                            </Button>
                          ) : null}
                          <IconAction label="Open posting" asChild>
                            <a href={job.link} target="_blank" rel="noopener noreferrer">
                              <ExternalLinkIcon />
                            </a>
                          </IconAction>
                          <IconAction label="Edit" onClick={() => startEdit(job)}>
                            <PencilIcon />
                          </IconAction>
                          <IconAction
                            label="Delete"
                            destructive
                            onClick={() => setDeleteId(job.id)}
                          >
                            <Trash2Icon />
                          </IconAction>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Research */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Research</CardTitle>
          <CardDescription>{research.length} saved snippets</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : research.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>No research captured yet</EmptyTitle>
                <EmptyDescription>
                  Save useful snippets from the extension to keep them here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {research.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="max-w-[70%] truncate">
                      {item.domain || item.sourceUrl || 'No source'}
                    </Badge>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Open
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                  </div>
                  <p className="line-clamp-3 text-sm text-muted-foreground">{item.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editingJob} onOpenChange={(o) => !o && setEditingJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit job</DialogTitle>
            <DialogDescription>Update the details for this captured job.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-company">Company</FieldLabel>
              <Input
                id="edit-company"
                value={editState.company}
                onChange={(e) => setEditState((s) => ({ ...s, company: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-role">Role</FieldLabel>
              <Input
                id="edit-role"
                value={editState.role}
                onChange={(e) => setEditState((s) => ({ ...s, role: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-location">Location</FieldLabel>
              <Input
                id="edit-location"
                value={editState.location}
                onChange={(e) => setEditState((s) => ({ ...s, location: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-deadline">Deadline</FieldLabel>
              <Input
                id="edit-deadline"
                value={editState.deadline}
                onChange={(e) => setEditState((s) => ({ ...s, deadline: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-notes">Notes</FieldLabel>
              <Textarea
                id="edit-notes"
                defaultValue={editingJob?.notes ?? ''}
                placeholder="Add notes about this role..."
                onBlur={(e) => editingJob && saveNotes(editingJob.id, e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingJob(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the job and its history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  loading: boolean
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-6 w-10" />
          ) : (
            <p className="text-xl font-semibold leading-none">{value}</p>
          )}
          <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function IconAction({
  label,
  children,
  onClick,
  asChild,
  destructive,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  asChild?: boolean
  destructive?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={destructive ? 'size-8 text-muted-foreground hover:text-destructive' : 'size-8 text-muted-foreground hover:text-foreground'}
          onClick={onClick}
          asChild={asChild}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
