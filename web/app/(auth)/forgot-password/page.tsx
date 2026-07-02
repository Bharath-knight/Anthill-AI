'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { FieldLabel, TextInput } from '@/components/ui/Input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [devUrl, setDevUrl] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setDevUrl('')
    setLoading(true)

    const res = await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Could not send reset email.')
      return
    }

    setMessage('If an account exists for that email, a reset link has been sent.')
    if (data.resetUrl) setDevUrl(data.resetUrl)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-pane bg-surface border border-border rounded-lg p-8 shadow-lg">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-8 h-8 rounded-md bg-accent text-bg grid place-items-center font-bold">A</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Reset password</h1>
            <p className="text-xs text-text3">Get a secure reset link by email.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
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
          {error && <p className="text-sm text-accent3">{error}</p>}
          {message && <p className="text-sm text-text2">{message}</p>}
          {devUrl && (
            <a href={devUrl} className="block break-all rounded border border-border bg-surface2 p-3 text-xs text-accent hover:opacity-80">
              Local reset link
            </a>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-center text-text3">
          Remembered it?{' '}
          <Link href="/login" className="text-accent hover:opacity-80 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
