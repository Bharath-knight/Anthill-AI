'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Receives the JWT from the Google sign-in callback via the URL fragment,
// moves it into localStorage (matching the email/password flow), then routes on.
export default function CompletePage() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const token = new URLSearchParams(hash).get('t')
    if (!token) {
      router.replace('/login?error=google')
      return
    }
    localStorage.setItem('anthill_token', token)
    window.history.replaceState(null, '', '/complete') // strip the token from the URL

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((user) => {
        if (user && user.id) localStorage.setItem('anthill_user', JSON.stringify(user))
      })
      .catch(() => {})
      .finally(() => router.replace('/jobs'))
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <p className="text-sm text-text3">Signing you in…</p>
    </div>
  )
}
