import { describe, it, expect, beforeEach } from 'vitest'
import { buildInitialState } from './StoreContext'

const KEY = 'fitlog:v1'

describe('buildInitialState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns a fully-empty state when localStorage is empty (seed-removal path)', () => {
    const state = buildInitialState()

    expect(state.routines).toEqual([])
    expect(state.routineOrder).toEqual([])
    expect(state.sessions).toEqual([])
    expect(state.measurements).toEqual([])
    expect(state.goals).toEqual([])
    expect(state.customExercises).toEqual([])
    expect(state.activeWorkout).toBeNull()
    expect(state.lastFinishedSession).toBeNull()
    // No seed generator remains in the codebase — this is a structural
    // guarantee, but also assert the shape itself has no seeded content.
    expect(state.sessions.length).toBe(0)
    expect(state.routines.length).toBe(0)
  })

  it('returns a persisted blob unchanged when localStorage already holds data (DATA-02)', () => {
    const persisted = {
      routines: [{ id: 'r1', name: 'Push Day' }],
      routineOrder: ['r1'],
      sessions: [{ id: 's1' }],
      customExercises: [{ id: 'custom-1', name: 'My Exercise' }],
    }
    localStorage.setItem(KEY, JSON.stringify(persisted))

    const state = buildInitialState()

    expect(state.routines).toEqual(persisted.routines)
    expect(state.sessions).toEqual(persisted.sessions)
    expect(state.customExercises).toEqual(persisted.customExercises)
    // Backfill fields added after this state was first saved — present
    // even though the persisted blob predates them.
    expect(state.weekdayAssignments).toBeDefined()
    expect(state.scheduleRestartAt).toBeNull()
  })

  it('backfills new settings keys for existing users without discarding their existing choices', () => {
    const persisted = {
      routines: [],
      routineOrder: [],
      sessions: [],
      customExercises: [],
      settings: { units: 'lb' }, // predates notifyRestDone/notifyOngoing/etc.
    }
    localStorage.setItem(KEY, JSON.stringify(persisted))

    const state = buildInitialState()

    expect(state.settings.units).toBe('lb') // user's own choice survives
    expect(state.settings.notifyRestDone).toBe(true) // new key reads as its default, not undefined
    expect(state.settings.notifyOngoing).toBe(true)
    expect(state.settings.notifyPR).toBe(true)
    expect(state.settings.notifyReminders).toBe(false)
    expect(state.settings.reminderTime).toBe('18:00')
  })

  it('backfills a full settings object for a persisted blob that never had one at all', () => {
    localStorage.setItem(KEY, JSON.stringify({ routines: [], routineOrder: [], sessions: [], customExercises: [] }))

    const state = buildInitialState()

    expect(state.settings.units).toBe('kg')
    expect(state.settings.notifyRestDone).toBe(true)
  })
})
