'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { bootstrapSession } from '@/lib/auth/client-auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    bootstrapSession()
      .then((user) => {
        if (!user) {
          router.replace('/login')
          return
        }
        setChecked(true)
      })
      .catch(() => router.replace('/login'))
  }, [router])

  if (!checked) return null

  return <AppShell>{children}</AppShell>
}
