'use client'
import { useEffect, useRef } from 'react'

// Auto-sync: run `refresh` on mount, on a fixed interval while the tab is visible,
// and immediately whenever the user returns to the tab (focus / visibilitychange).
// This is what makes a link saved from the extension show up in an already-open app
// without a manual reload. It deliberately does NOT own the page's data — each page
// keeps its own state and optimistic updates and just passes a refresh callback.
//
// Polling is paused while the tab is hidden (no background churn) and resumes with an
// immediate refresh on return, so the user always sees current data when looking.
export function useRevalidate(refresh: () => void | Promise<void>, intervalMs = 15000) {
  const ref = useRef(refresh)
  ref.current = refresh

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') ref.current()
    }
    run() // initial load
    const id = setInterval(run, intervalMs)
    document.addEventListener('visibilitychange', run)
    window.addEventListener('focus', run)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('focus', run)
    }
  }, [intervalMs])
}
