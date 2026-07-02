'use client'
// Shared client-side store for the active Tasks smart-list + a "new task" focus signal.
//
// The sidebar (inside AppShell) and the Tasks page are separate React subtrees,
// so they can't share component state directly, and routing the view through the
// URL hash failed: Next's App Router navigates hash links via history.pushState,
// which does NOT fire `hashchange`. This tiny external store lets a sidebar click
// update the Tasks view synchronously, everywhere, with no URL/event dependency.
import { useSyncExternalStore } from 'react'
import type { TaskView } from '@/lib/tasks/smart-date'

let current: TaskView = 'all'
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
  return useSyncExternalStore(subscribe, () => current, () => 'all')
}

// "New task" intent: the sidebar button asks the Tasks page to focus its quick-add
// input. The flag survives a cross-page navigation (consumed on the next mount);
// the listeners cover the same-page case (page already mounted).
let focusRequested = false
const focusListeners = new Set<() => void>()

export function requestNewTask() {
  focusRequested = true
  focusListeners.forEach((l) => l())
}

export function consumeFocusRequest(): boolean {
  if (!focusRequested) return false
  focusRequested = false
  return true
}

export function onNewTaskRequest(l: () => void) {
  focusListeners.add(l)
  return () => { focusListeners.delete(l) }
}
