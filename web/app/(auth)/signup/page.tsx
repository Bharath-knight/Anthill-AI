'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TextInput, FieldLabel } from '@/components/Input'
import { Button } from '@/components/Button'
import { GoogleButton } from '@/components/GoogleButton'
import { persistSession } from '@/lib/client-auth'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: name || undefined }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Signup failed')
      return
    }
    persistSession(data.token, data.user)
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
            <p className="text-xs text-text3">Create your account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Name (optional)</FieldLabel>
            <TextInput
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min. 8 characters"
            />
          </div>
          {error && <p className="text-sm text-accent3">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wide text-text3">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton label="Sign up with Google" />

        <p className="mt-6 text-sm text-center text-text3">
          Have an account?{' '}
          <Link href="/login" className="text-accent hover:opacity-80 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
