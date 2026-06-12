'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExternalLinkIcon,
  Trash2Icon,
  BriefcaseIcon,
  SearchIcon,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { StatusSelect, STATUS_OPTIONS } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

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

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function token() {
    return localStorage.getItem('anthill_token')
  }

  async function fetchJobs() {
    const tk = token()
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
  }

  useEffect(() => {
    fetchJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function updateStatus(id: string, status: string) {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: status as Job['status'] } : j)),
    )
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  async function confirmDelete() {
    if (!deleteId) return
    await fetch(`/api/jobs/${deleteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    })
    setJobs((prev) => prev.filter((j) => j.id !== deleteId))
    setDeleteId(null)
    toast.success('Job deleted.')
  }

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      j.company.toLowerCase().includes(q) ||
      j.role.toLowerCase().includes(q) ||
      (j.location || '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'ALL' || j.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <AppShell title="Jobs" description="Track every application in one pipeline">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search company, role, location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} job{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <Card className="mt-5">
        <CardContent className="px-0 py-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-6">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BriefcaseIcon />
                  </EmptyMedia>
                  <EmptyTitle>
                    {jobs.length === 0 ? 'No jobs yet' : 'No matches'}
                  </EmptyTitle>
                  <EmptyDescription>
                    {jobs.length === 0
                      ? 'Use the Chrome extension to capture job postings.'
                      : 'Try adjusting your search or status filter.'}
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
                  {filtered.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.company}</TableCell>
                      <TableCell className="max-w-[220px]">
                        <span className="block truncate">{job.role}</span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {job.location || '—'}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                        {job.deadline || '—'}
                      </TableCell>
                      <TableCell>
                        <StatusSelect value={job.status} onChange={(s) => updateStatus(job.id, s)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground"
                                aria-label="Open posting"
                              >
                                <a href={job.link} target="_blank" rel="noopener noreferrer">
                                  <ExternalLinkIcon />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open posting</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteId(job.id)}
                                aria-label="Delete"
                              >
                                <Trash2Icon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
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
