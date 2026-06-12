'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExternalLinkIcon,
  SearchIcon,
  SparklesIcon,
  Loader2Icon,
  CheckIcon,
  XIcon,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { toast } from 'sonner'

type Match = {
  id: string
  matchScore: number
  matchedKeywords: string[]
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  task: { id: string; title: string }
}

type ResearchItem = {
  id: string
  content: string
  sourceUrl: string | null
  domain: string | null
  createdAt: string
  matches: Match[]
}

export default function ResearchPage() {
  const router = useRouter()
  const [items, setItems] = useState<ResearchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  function token() {
    return localStorage.getItem('anthill_token')
  }

  async function fetchResearch() {
    const tk = token()
    if (!tk) {
      router.replace('/login')
      return
    }
    const res = await fetch('/api/research', { headers: { Authorization: `Bearer ${tk}` } })
    if (res.status === 401) {
      router.replace('/login')
      return
    }
    setItems(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetchResearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runMatching() {
    setRunning(true)
    const res = await fetch('/api/match/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    })
    const data = await res.json()
    await fetchResearch()
    setRunning(false)
    toast.success(`Found ${data.matched} match${data.matched !== 1 ? 'es' : ''}`)
  }

  async function updateMatch(matchId: string, status: 'ACCEPTED' | 'REJECTED') {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        matches: item.matches.map((m) => (m.id === matchId ? { ...m, status } : m)),
      })),
    )
    await fetch(`/api/match/${matchId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  return (
    <AppShell
      title="Research"
      description="Saved snippets and matched tasks"
      actions={
        <Button onClick={runMatching} disabled={running} size="sm">
          {running ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <SparklesIcon data-icon="inline-start" />
          )}
          {running ? 'Running...' : 'Run matching'}
        </Button>
      }
    >
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>No research yet</EmptyTitle>
            <EmptyDescription>
              Use the extension to save research content, then run matching to link it to tasks.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="gap-0">
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2">
                  {item.domain && <Badge variant="secondary">{item.domain}</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Source
                    <ExternalLinkIcon className="size-3" />
                  </a>
                )}
              </CardHeader>
              <CardContent className="pt-3">
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {item.content}
                </p>

                {item.matches.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Matched tasks
                    </p>
                    <div className="flex flex-col gap-2">
                      {item.matches.map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between gap-2 rounded-md bg-secondary/50 px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge variant="outline" className="shrink-0 font-mono">
                              {Math.round(match.matchScore * 100)}%
                            </Badge>
                            <span className="truncate text-sm font-medium">
                              {match.task.title}
                            </span>
                          </div>
                          {match.status === 'PENDING' ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-status-offer"
                                onClick={() => updateMatch(match.id, 'ACCEPTED')}
                                aria-label="Accept match"
                              >
                                <CheckIcon />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                onClick={() => updateMatch(match.id, 'REJECTED')}
                                aria-label="Reject match"
                              >
                                <XIcon />
                              </Button>
                            </div>
                          ) : (
                            <Badge
                              variant={match.status === 'ACCEPTED' ? 'default' : 'secondary'}
                              className="shrink-0"
                            >
                              {match.status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  )
}
