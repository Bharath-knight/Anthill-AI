import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRevalidate } from './use-revalidate'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

describe('useRevalidate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes once on mount', () => {
    const refresh = vi.fn()
    renderHook(() => useRevalidate(refresh, 1000))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('polls on the interval while the tab is visible', () => {
    const refresh = vi.fn()
    renderHook(() => useRevalidate(refresh, 1000))
    expect(refresh).toHaveBeenCalledTimes(1) // mount
    vi.advanceTimersByTime(3000)
    expect(refresh).toHaveBeenCalledTimes(4) // + 3 ticks
  })

  it('does not poll while the tab is hidden', () => {
    const refresh = vi.fn()
    renderHook(() => useRevalidate(refresh, 1000))
    refresh.mockClear() // ignore the mount call
    setVisibility('hidden')
    vi.advanceTimersByTime(3000)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes when the tab regains focus or visibility', () => {
    const refresh = vi.fn()
    renderHook(() => useRevalidate(refresh, 100000)) // long interval stays out of the way
    refresh.mockClear()
    window.dispatchEvent(new Event('focus'))
    expect(refresh).toHaveBeenCalledTimes(1)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('stops refreshing after unmount', () => {
    const refresh = vi.fn()
    const { unmount } = renderHook(() => useRevalidate(refresh, 1000))
    refresh.mockClear()
    unmount()
    vi.advanceTimersByTime(5000)
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).not.toHaveBeenCalled()
  })
})
