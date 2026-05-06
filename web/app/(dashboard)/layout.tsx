'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/jobs', label: 'Jobs', icon: '💼' },
  { href: '/research', label: 'Research', icon: '🔍' },
  { href: '/tasks', label: 'Tasks', icon: '✓' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('anthill_token')
    if (!token) { router.replace('/login'); return }
    const stored = localStorage.getItem('anthill_user')
    if (stored) setUser(JSON.parse(stored))
  }, [router])

  function logout() {
    localStorage.removeItem('anthill_token')
    localStorage.removeItem('anthill_user')
    router.replace('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-48 bg-white border-r flex flex-col py-6 px-3 shrink-0">
        <div className="px-2 mb-8">
          <h1 className="text-lg font-bold tracking-tight">Anthill</h1>
          <p className="text-xs text-gray-400 mt-0.5">Job search organizer</p>
        </div>
        <nav className="flex-1 space-y-0.5">
          {NAV.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-gray-100 text-black'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-black'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t pt-4 px-2 space-y-1">
          {user && (
            <p className="text-xs text-gray-400 truncate" title={user.email}>
              {user.name || user.email}
            </p>
          )}
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-black transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto min-w-0">{children}</main>
    </div>
  )
}
