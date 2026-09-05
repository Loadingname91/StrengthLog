import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextUpSince, dueInfo, dayStatus, weekStripDates, defaultWeekdayAssignments } from './schedule'

afterEach(() => {
  vi.useRealTimers()
})

describe('defaultWeekdayAssignments', () => {
  it('spreads up to 7 routines across Mon(1)..Sun(0) in order', () => {
    const map = defaultWeekdayAssignments(['r1', 'r2', 'r3'])
    expect(map).toEqual({ r1: 1, r2: 2, r3: 3 })
  })

  it('ignores routines beyond the 7th', () => {
    const order = Array.from({ length: 9 }, (_, i) => `r${i}`)
    const map = defaultWeekdayAssignments(order)
    expect(Object.keys(map)).toHaveLength(7)
    expect(map.r0).toBe(1)
    expect(map.r6).toBe(0) // 7th routine (index 6) wraps to Sunday
    expect(map.r7).toBeUndefined()
    expect(map.r8).toBeUndefined()
  })
})

describe('nextUpSince', () => {
  it('returns the day after the last session when no restart anchor is set', () => {
    const sessions = [{ date: '2026-01-05' }, { date: '2026-01-10' }]
    expect(nextUpSince(sessions, null, '2026-01-01')).toBe('2026-01-11')
  })

  it('falls back to the day after createdAt when there are no sessions', () => {
    expect(nextUpSince([], null, '2026-01-01')).toBe('2026-01-02')
  })

  it('uses the restart anchor when it is later than the day after the last session', () => {
    const sessions = [{ date: '2026-01-05' }]
    expect(nextUpSince(sessions, '2026-02-01', '2026-01-01')).toBe('2026-02-01')
  })

  it('ignores a restart anchor that is earlier than the day after the last session', () => {
    const sessions = [{ date: '2026-01-05' }]
    expect(nextUpSince(sessions, '2026-01-03', '2026-01-01')).toBe('2026-01-06')
  })
})

describe('dueInfo', () => {
  it('is due today when the next occurrence of the assigned weekday is today', () => {
    // 2026-01-08 is a Thursday (weekday 4).
    const info = dueInfo('r1', { r1: 4 }, [], null, '2026-01-01', '2026-01-08')
    expect(info.dueDate).toBe('2026-01-08')
    expect(info.isToday).toBe(true)
    expect(info.isOverdue).toBe(false)
  })

  it('is overdue when the due date has already passed', () => {
    // Assigned weekday Monday(1); since=2026-01-01 (Thursday) -> next Monday is 2026-01-05.
    const info = dueInfo('r1', { r1: 1 }, [], null, '2026-01-01', '2026-01-08')
    expect(info.dueDate).toBe('2026-01-05')
    expect(info.isOverdue).toBe(true)
    expect(info.isToday).toBe(false)
  })

  it('with no weekday assignment, is due exactly on the since date', () => {
    const info = dueInfo('r1', {}, [], null, '2026-01-01', '2026-01-01')
    expect(info.dueDate).toBe('2026-01-02')
    expect(info.weekday).toBeNull()
  })
})

describe('dayStatus', () => {
  const assignments = { r1: 4 } // Thursday

  it('marks a future date as future regardless of assignment', () => {
    expect(dayStatus('2026-02-01', assignments, [], '2026-01-01').state).toBe('future')
  })

  it('marks a date with a completed session as done', () => {
    const sessions = [{ date: '2026-01-08' }]
    expect(dayStatus('2026-01-08', assignments, sessions, '2026-01-08').state).toBe('done')
  })

  it('marks a date with no routine assigned as rest', () => {
    expect(dayStatus('2026-01-07', assignments, [], '2026-01-08').state).toBe('rest')
  })

  it('marks today with an assigned routine and no session as today', () => {
    // 2026-01-08 is Thursday.
    expect(dayStatus('2026-01-08', assignments, [], '2026-01-08').state).toBe('today')
  })

  it('marks a past assigned date with no session as missed', () => {
    // Previous Thursday: 2026-01-01.
    expect(dayStatus('2026-01-01', assignments, [], '2026-01-08').state).toBe('missed')
  })
})

describe('weekStripDates', () => {
  it('returns 7 consecutive Mon-Sun dates for the current week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 8)) // Thursday, Jan 8 2026 (local time)

    const dates = weekStripDates(0)

    expect(dates).toHaveLength(7)
    expect(dates[0]).toBe('2026-01-05') // Monday
    expect(dates[6]).toBe('2026-01-11') // Sunday
    expect(dates).toContain('2026-01-08')
  })

  it('shifts by a full week per weekOffset', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 8))

    const nextWeek = weekStripDates(1)

    expect(nextWeek[0]).toBe('2026-01-12')
    expect(nextWeek[6]).toBe('2026-01-18')
  })
})
