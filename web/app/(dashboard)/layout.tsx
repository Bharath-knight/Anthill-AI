'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('anthill_token')
    if (!token) {
      router.replace('/login')
      return
    }
    setChecked(true)
  }, [router])

  if (!checked) return null

  return <AppShell>{children}</AppShell>
}
