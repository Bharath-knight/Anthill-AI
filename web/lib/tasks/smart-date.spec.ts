import { describe, expect, it } from 'vitest'
import {
  urgency,
  relativeLabel,
  pendingForView,
  completedForView,
  seedDeadlineForView,
  plusDaysInputValue,
  todayInputValue,
} from './smart-date'

// Deadlines are 'YYYY-MM-DD' strings interpreted against *today*. We build inputs
// with the module's own date helpers so the tests stay deterministic regardless
// of the machine's timezone or the current date.
const today = todayInputValue()
const yesterday = plusDaysInputValue(-1)
const inThreeDays = plusDaysInputValue(3)
const inTenDays = plusDaysInputValue(10)

type Task = { completed: boolean; deadline: string | null }

describe('urgency', () => {
  it('classifies a deadline relative to today', () => {
    expect(urgency(today)).toBe('today')
    expect(urgency(yesterday)).toBe('overdue')
    expect(urgency(inThreeDays)).toBe('upcoming')
    expect(urgency(null)).toBe('none')
  })
})

describe('relativeLabel', () => {
  it('uses friendly words for near dates', () => {
    expect(relativeLabel(today)).toBe('Today')
    expect(relativeLabel(plusDaysInputValue(1))).toBe('Tomorrow')
    expect(relativeLabel(yesterday)).toBe('Yesterday')
    expect(relativeLabel(plusDaysInputValue(-3))).toBe('3d overdue')
    expect(relativeLabel(null)).toBe('')
  })
})

describe('pendingForView', () => {
  const tasks: Task[] = [
    { completed: false, deadline: yesterday },   // overdue
    { completed: false, deadline: today },       // today
    { completed: false, deadline: inThreeDays }, // next 7
    { completed: false, deadline: inTenDays },   // upcoming
    { completed: false, deadline: null },        // no date
    { completed: true, deadline: today },        // completed (excluded)
  ]

  it('"all" returns every pending task', () => {
    expect(pendingForView(tasks, 'all')).toHaveLength(5)
  })

  it('"today" rolls overdue into today', () => {
    expect(pendingForView(tasks, 'today').map((t) => t.deadline)).toEqual([yesterday, today])
  })

  it('"next7" spans today through +7 days', () => {
    expect(pendingForView(tasks, 'next7').map((t) => t.deadline)).toEqual([today, inThreeDays])
  })

  it('"upcoming" is strictly beyond 7 days', () => {
    expect(pendingForView(tasks, 'upcoming').map((t) => t.deadline)).toEqual([inTenDays])
  })

  it('"nodate" is the undated inbox', () => {
    expect(pendingForView(tasks, 'nodate').map((t) => t.deadline)).toEqual([null])
  })

  it('"completed" holds no pending tasks', () => {
    expect(pendingForView(tasks, 'completed')).toHaveLength(0)
  })
})

describe('completedForView', () => {
  const tasks: Task[] = [
    { completed: true, deadline: today },
    { completed: true, deadline: inTenDays },
    { completed: false, deadline: today },
  ]

  it('"all" and "completed" return every done task', () => {
    expect(completedForView(tasks, 'all')).toHaveLength(2)
    expect(completedForView(tasks, 'completed')).toHaveLength(2)
  })

  it('bucket views only return done tasks in that bucket', () => {
    expect(completedForView(tasks, 'upcoming').map((t) => t.deadline)).toEqual([inTenDays])
  })
})

describe('seedDeadlineForView', () => {
  it('seeds a new task so it lands inside the active list', () => {
    expect(seedDeadlineForView('today')).toBe(todayInputValue())
    expect(seedDeadlineForView('next7')).toBe(todayInputValue())
    expect(seedDeadlineForView('upcoming')).toBe(plusDaysInputValue(8))
    expect(seedDeadlineForView('nodate')).toBeNull()
    expect(seedDeadlineForView('all')).toBeNull()
  })
})
