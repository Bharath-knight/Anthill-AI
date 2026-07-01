'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/Button'
import { Tag, TypeDot } from '@/components/Tag'
import { EmptyState } from '@/components/EmptyState'
import { getToken } from '@/lib/api-client'

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
  const [matchMsg, setMatchMsg] = useState('')

  async function fetchResearch() {
    const tk = getToken()
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
  }, [])

  async function runMatching() {
    setRunning(true)
    setMatchMsg('')
    const res = await fetch('/api/match/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const data = await res.json()
    setMatchMsg(`Found ${data.matched} match${data.matched !== 1 ? 'es' : ''}`)
    await fetchResearch()
    setRunning(false)
  }

  async function updateMatch(matchId: string, status: 'ACCEPTED' | 'REJECTED') {
    await fetch(`/api/match/${matchId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        matches: item.matches.map((m) => (m.id === matchId ? { ...m, status } : m)),
      }))
    )
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Research</h1>
          <p className="text-sm text-text2 mt-1">Saved from the extension.</p>
        </div>
        <div className="flex items-center gap-3">
          {matchMsg && <span className="text-[11px] text-text2">{matchMsg}</span>}
          <Button onClick={runMatching} disabled={running}>
            {running ? 'Running...' : 'Run matching'}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text3">Loading...</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search size={32} strokeWidth={1.5} />}
          title="No research yet"
          subtitle="Use the extension to save research content."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="group glass-pane bg-surface border border-border rounded-lg p-4 transition-colors duration-150 hover:border-border2"
            >
              <div className="flex items-start gap-3">
                <div className="pt-1.5">
                  <TypeDot color="accent2" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {item.domain && <Tag variant="accent2">{item.domain}</Tag>}
                    <span className="text-[11px] text-text3">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-text2 hover:text-accent2 transition-colors ml-auto"
                      >
                        <ArrowUpRight size={11} strokeWidth={2.25} /> Source
                      </a>
                    )}
                  </div>

                  <p className="text-sm text-text2 leading-relaxed line-clamp-3">{item.content}</p>

                  {item.matches.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border space-y-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-text3">
                        Matched tasks
                      </div>
                      {item.matches.map((match) => (
                        <div key={match.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm text-text truncate">{match.task.title}</span>
                            <span className="text-[11px] text-text3 shrink-0">
                              {Math.round(match.matchScore * 100)}%
                            </span>
                          </div>
                          {match.status === 'PENDING' ? (
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => updateMatch(match.id, 'ACCEPTED')}
                                className="text-xs text-accent hover:opacity-80 font-medium"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => updateMatch(match.id, 'REJECTED')}
                                className="text-xs text-text3 hover:text-accent3"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <Tag
                              variant={match.status === 'ACCEPTED' ? 'accent' : 'default'}
                            >
                              {match.status}
                            </Tag>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
