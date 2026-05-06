'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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

  function token() { return localStorage.getItem('anthill_token') }

  async function fetchResearch() {
    const tk = token()
    if (!tk) { router.replace('/login'); return }
    const res = await fetch('/api/research', { headers: { Authorization: `Bearer ${tk}` } })
    if (res.status === 401) { router.replace('/login'); return }
    setItems(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchResearch() }, [])

  async function runMatching() {
    setRunning(true)
    setMatchMsg('')
    const res = await fetch('/api/match/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    })
    const data = await res.json()
    setMatchMsg(`Found ${data.matched} match${data.matched !== 1 ? 'es' : ''}`)
    await fetchResearch()
    setRunning(false)
  }

  async function updateMatch(matchId: string, status: 'ACCEPTED' | 'REJECTED') {
    await fetch(`/api/match/${matchId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setItems(prev =>
      prev.map(item => ({
        ...item,
        matches: item.matches.map(m => m.id === matchId ? { ...m, status } : m),
      }))
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Research</h2>
          <p className="text-sm text-gray-400 mt-0.5">Saved from the extension</p>
        </div>
        <div className="flex items-center gap-3">
          {matchMsg && <span className="text-xs text-gray-500">{matchMsg}</span>}
          <button
            onClick={runMatching}
            disabled={running}
            className="text-sm bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {running ? 'Running...' : 'Run Matching'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No research yet.</p>
          <p className="text-xs mt-1">Use the extension to save research content.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {item.domain && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {item.domain}
                    </span>
                  )}
                  <span className="text-xs text-gray-300">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline">
                    Source ↗
                  </a>
                )}
              </div>

              <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                {item.content}
              </p>

              {item.matches.length > 0 && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Matched tasks</p>
                  {item.matches.map(match => (
                    <div key={match.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{match.task.title}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {Math.round(match.matchScore * 100)}%
                        </span>
                        {match.matchedKeywords.length > 0 && (
                          <span className="text-xs text-gray-300 shrink-0 hidden sm:inline">
                            [{match.matchedKeywords.slice(0, 3).join(', ')}]
                          </span>
                        )}
                      </div>
                      {match.status === 'PENDING' ? (
                        <div className="flex gap-2 shrink-0 ml-2">
                          <button onClick={() => updateMatch(match.id, 'ACCEPTED')}
                            className="text-xs text-green-600 hover:text-green-700 font-medium">
                            Accept
                          </button>
                          <button onClick={() => updateMatch(match.id, 'REJECTED')}
                            className="text-xs text-gray-400 hover:text-red-500">
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={`text-xs font-medium shrink-0 ml-2 ${
                          match.status === 'ACCEPTED' ? 'text-green-600' : 'text-gray-300'
                        }`}>
                          {match.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
