import { describe, it, expect } from 'vitest'
import {
  buildReminderPlan,
  nextFreeSeq,
  reminderNotificationId,
  ALL_REMINDER_IDS,
  MAX_REMINDERS,
  ONESHOT_SLOT,
} from './reminderPlan'

function reminder(overrides = {}) {
  return { id: 'rem1', seq: 0, enabled: true, mode: 'auto', time: '18:00', days: [], label: '', ...overrides }
}

function baseState(overrides = {}) {
  return {
    reminders: [reminder()],
    routineMode: 'sequence',
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

describe('buildReminderPlan — nothing to schedule', () => {
  it('returns nothing when there are no reminders at all', () => {
    expect(buildReminderPlan(baseState({ reminders: [] }), new Date(2026, 0, 8, 10, 0))).toEqual([])
  })

  it('skips a disabled reminder', () => {
    const state = baseState({ reminders: [reminder({ enabled: false })] })
    expect(buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))).toEqual([])
  })

  it('returns nothing when there is no next-up routine to remind about', () => {
    const state = baseState({ routines: [], routineOrder: [] })
    expect(buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))).toEqual([])
  })
})

describe('buildReminderPlan — custom (alarm-style) reminders', () => {
  it('expands one recurring entry per selected day, in app weekday convention', () => {
    const state = baseState({ reminders: [reminder({ mode: 'custom', days: [1, 3, 5], label: 'Gym' })] })

    const plan = buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))

    expect(plan).toHaveLength(3)
    expect(plan.map((e) => e.id)).toEqual([9001, 9003, 9005])
    expect(plan[0].on).toEqual({ weekday: 1, hour: 18, minute: 0 })
    expect(plan[2].on).toEqual({ weekday: 5, hour: 18, minute: 0 })
    expect(plan.every((e) => e.title === 'Gym')).toBe(true)
    expect(plan[0].at).toBeUndefined()
  })

  it('falls back to a generic title when no label is set', () => {
    const state = baseState({ reminders: [reminder({ mode: 'custom', days: [0] })] })
    expect(buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))[0].title).toBe('Workout reminder')
  })

  it('schedules nothing for a custom reminder with no days selected', () => {
    const state = baseState({ reminders: [reminder({ mode: 'custom', days: [] })] })
    expect(buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))).toEqual([])
  })

  it('gives two reminders on the same day at the same time distinct ids', () => {
    const state = baseState({
      reminders: [
        reminder({ id: 'a', seq: 0, mode: 'custom', days: [1] }),
        reminder({ id: 'b', seq: 1, mode: 'custom', days: [1] }),
      ],
    })

    const plan = buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))

    expect(plan.map((e) => e.id)).toEqual([9001, 9009])
  })
})

describe('buildReminderPlan — auto reminders in weekday mode', () => {
  it('expands one standing weekly entry per assigned routine', () => {
    const state = baseState({
      routineMode: 'weekday',
      routines: [{ id: 'r1', name: 'Push Day' }, { id: 'r2', name: 'Pull Day' }],
      routineOrder: ['r1', 'r2'],
      weekdayAssignments: { r1: 1, r2: 3 },
    })

    const plan = buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))

    expect(plan).toHaveLength(2)
    expect(plan[0]).toMatchObject({ id: 9001, title: 'Time for Push Day', body: 'Assigned for Monday' })
    expect(plan[0].on).toEqual({ weekday: 1, hour: 18, minute: 0 })
    expect(plan[1]).toMatchObject({ id: 9003, title: 'Time for Pull Day', body: 'Assigned for Wednesday' })
  })

  it('ignores an assignment whose routine no longer exists', () => {
    const state = baseState({
      routineMode: 'weekday',
      weekdayAssignments: { r1: 1, deleted: 4 },
    })

    const plan = buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))

    expect(plan).toHaveLength(1)
    expect(plan[0].id).toBe(9001)
  })
})

describe('buildReminderPlan — auto reminders in sequence mode stay one-shot', () => {
  it('schedules today at the reminder time when the next-up routine is overdue', () => {
    const plan = buildReminderPlan(baseState(), new Date(2026, 0, 8, 10, 0))

    expect(plan).toHaveLength(1)
    expect(plan[0].id).toBe(reminderNotificationId(0, ONESHOT_SLOT))
    expect(plan[0].at).toEqual(new Date(2026, 0, 8, 18, 0, 0, 0))
    expect(plan[0].title).toBe('Push Day is overdue')
    expect(plan[0].body).toBe('Tap to start your next workout')
    expect(plan[0].on).toBeUndefined()
  })

  it('skips today entirely once the reminder time has already passed', () => {
    expect(buildReminderPlan(baseState(), new Date(2026, 0, 8, 19, 0))).toEqual([])
  })

  it('fires today for a brand-new account with no sessions yet', () => {
    const state = baseState({ createdAt: '2026-01-08' })
    const plan = buildReminderPlan(state, new Date(2026, 0, 8, 10, 0))

    expect(plan).toHaveLength(1)
    expect(plan[0].at).toEqual(new Date(2026, 0, 8, 18, 0, 0, 0))
    expect(plan[0].title).toBe('Time for Push Day')
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

  it('honours each reminder own time', () => {
    const state = baseState({ reminders: [reminder({ time: '07:30' })] })
    const plan = buildReminderPlan(state, new Date(2026, 0, 8, 6, 0))

    expect(plan[0].at).toEqual(new Date(2026, 0, 8, 7, 30, 0, 0))
  })
})

describe('reminder id allocation', () => {
  it('keeps every id unique and inside the reserved range at full capacity', () => {
    const reminders = Array.from({ length: MAX_REMINDERS }, (_, seq) => (
      reminder({ id: `rem${seq}`, seq, mode: 'custom', days: [0, 1, 2, 3, 4, 5, 6] })
    ))

    const plan = buildReminderPlan(baseState({ reminders }), new Date(2026, 0, 8, 10, 0))
    const ids = plan.map((e) => e.id)

    expect(ids).toHaveLength(MAX_REMINDERS * 7)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => ALL_REMINDER_IDS.includes(id))).toBe(true)
  })

  it('nextFreeSeq reuses the lowest freed slot', () => {
    expect(nextFreeSeq([{ seq: 0 }, { seq: 2 }])).toBe(1)
  })

  it('nextFreeSeq returns null once every slot is taken', () => {
    const full = Array.from({ length: MAX_REMINDERS }, (_, seq) => ({ seq }))
    expect(nextFreeSeq(full)).toBeNull()
  })
})
