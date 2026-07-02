'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { FieldLabel, TextInput } from '@/components/ui/Input'
import { persistSession } from '@/lib/auth/client-auth'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '')
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('This reset link is missing a token.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not reset password.')
      return
    }

    persistSession(data.token, data.user)
    router.replace('/tasks')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-pane bg-surface border border-border rounded-lg p-8 shadow-lg">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-8 h-8 rounded-md bg-accent text-bg grid place-items-center font-bold">A</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Choose a new password</h1>
            <p className="text-xs text-text3">Reset links expire after one hour.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <FieldLabel>New password</FieldLabel>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoFocus
            />
          </div>
          <div>
            <FieldLabel>Confirm password</FieldLabel>
            <TextInput
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error && <p className="text-sm text-accent3">{error}</p>}
          <Button type="submit" disabled={loading || !token} className="w-full">
            {loading ? 'Resetting...' : 'Reset password'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-center text-text3">
          Need a fresh link?{' '}
          <Link href="/forgot-password" className="text-accent hover:opacity-80 font-medium">
            Send another
          </Link>
        </p>
      </div>
    </div>
  )
}
