'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TextInput, FieldLabel } from '@/components/Input'
import { Button } from '@/components/Button'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Login failed')
      return
    }
    localStorage.setItem('anthill_token', data.token)
    localStorage.setItem('anthill_user', JSON.stringify(data.user))
    router.push('/jobs')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-pane bg-surface border border-border rounded-lg p-8 shadow-lg">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-8 h-8 rounded-md bg-accent text-bg grid place-items-center font-bold">
            A
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Anthill</h1>
            <p className="text-xs text-text3">Sign in to your account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-accent3">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-center text-text3">
          No account?{' '}
          <Link href="/signup" className="text-accent hover:opacity-80 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
