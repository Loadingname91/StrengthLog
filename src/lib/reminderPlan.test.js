import { describe, it, expect } from 'vitest'
import { buildReminderPlan, REMINDER_ID } from './reminderPlan'

function baseState(overrides = {}) {
  return {
    settings: { notifyReminders: true, reminderTime: '18:00' },
    routines: [{ id: 'r1', name: 'Push Day' }],
    routineOrder: ['r1'],
    sequenceIndex: 0,
    weekdayAssignments: {},
    sessions: [],
    scheduleRestartAt: null,
    createdAt: '2026-01-01',
    ...overrides,
  }
}

describe('buildReminderPlan', () => {
  it('returns nothing when reminders are turned off', () => {
    const state = baseState({ settings: { notifyReminders: false, reminderTime: '18:00' } })
    expect(buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))).toEqual([])
  })

  it('returns nothing when there is no next-up routine to remind about', () => {
    const state = baseState({ routines: [], routineOrder: [] })
    expect(buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))).toEqual([])
  })

  it('schedules today at reminderTime when the next-up routine is overdue (sequence mode)', () => {
    // No weekday assignment: dueInfo is due exactly on the day after
    // createdAt, which by Jan 8 is well in the past — overdue.
    const state = baseState()
    const plan = buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))

    expect(plan).toHaveLength(1)
    expect(plan[0].id).toBe(REMINDER_ID)
    expect(plan[0].at).toEqual(new Date(2026, 0, 8, 18, 0, 0, 0))
    expect(plan[0].title).toBe('Push Day is overdue')
    expect(plan[0].body).toBe('Tap to start your next workout')
  })

  it('skips today entirely once reminderTime has already passed', () => {
    const state = baseState()
    expect(buildReminderPlan(state, new Date(2026, 0, 8, 19, 0))).toEqual([])
  })

  it('schedules a future weekday reminder when the routine is not yet due', () => {
    // Last session today (Jan 8, Thu) -> next-up since Jan 9 (Fri).
    // Assigned weekday Monday -> next occurrence Jan 12, still ahead of "now".
    const state = baseState({
      weekdayAssignments: { r1: 1 },
      sessions: [{ date: '2026-01-08', routineId: 'r1' }],
    })
    const plan = buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))

    expect(plan).toHaveLength(1)
    expect(plan[0].at).toEqual(new Date(2026, 0, 12, 18, 0, 0, 0))
    expect(plan[0].title).toBe('Time for Push Day')
    expect(plan[0].body).toBe('Assigned for Monday')
  })
})
