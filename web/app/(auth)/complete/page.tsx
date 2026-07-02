'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, persistSession } from '@/lib/auth/client-auth'

// Receives the JWT from the Google sign-in callback via the URL fragment,
// moves it into durable client storage, then routes on.
export default function CompletePage() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const token = params.get('t')
    const setupPassword = params.get('setupPassword') === '1'
    if (!token) {
      // No token in the URL (e.g. manual navigation): if already signed in, just
      // continue; otherwise send back to login.
      router.replace(getToken() ? '/tasks' : '/login?error=google')
      return
    }
    const authToken = token
    window.history.replaceState(null, '', '/complete') // strip the token from the URL

    async function finishGoogleSignIn() {
      try {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
        if (!res.ok) {
          router.replace('/login?error=google')
          return
        }
        const user = await res.json()
        persistSession(authToken, user)
        router.replace(setupPassword || user.hasPassword === false ? '/tasks?setupPassword=1' : '/tasks')
      } catch {
        router.replace('/login?error=google')
      }
    }

    finishGoogleSignIn()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <p className="text-sm text-text3">Signing you in…</p>
    </div>
  )
}
