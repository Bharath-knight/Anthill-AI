'use client'
// Shared client-side store for the active Tasks smart-list.
//
// The sidebar (inside AppShell) and the Tasks page are separate React subtrees,
// so they can't share component state directly, and routing the view through the
// URL hash failed: Next's App Router navigates hash links via history.pushState,
// which does NOT fire `hashchange`. This tiny external store lets a sidebar click
// update the Tasks view synchronously, everywhere, with no URL/event dependency.
import { useSyncExternalStore } from 'react'
import type { TaskView } from './smart-date'

let current: TaskView = 'today'
const listeners = new Set<() => void>()

export function setTaskView(v: TaskView) {
  if (v === current) return
  current = v
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function useTaskView(): TaskView {
  return useSyncExternalStore(subscribe, () => current, () => 'today')
}
