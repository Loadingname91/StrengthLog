import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWorkoutNotifications } from './useWorkoutNotifications'
import { reducer } from './reducer'

vi.mock('../lib/nativeNotifications', () => ({
  startWorkout: vi.fn(),
  updateWorkout: vi.fn(),
  stopWorkout: vi.fn(),
  notifyPR: vi.fn(),
  scheduleReminders: vi.fn(),
}))
import * as native from '../lib/nativeNotifications'

function baseState(overrides = {}) {
  return {
    settings: { units: 'kg', theme: 'system', restDefault: 90, showRIR: true, notifyReminders: false, reminderTime: '18:00' },
    user: { name: 'Athlete' },
    customExercises: [],
    exerciseNotes: {},
    importPresets: [],
    lastFinishedSession: null,
    routines: [],
    routineOrder: [],
    sequenceIndex: 0,
    routineMode: 'sequence',
    weekdayAssignments: {},
    scheduleRestartAt: null,
    sessions: [],
    measurements: [],
    goals: [],
    activeWorkout: null,
    lastImportedAt: null,
    createdAt: '2026-01-01',
    ...overrides,
  }
}

function sampleRoutine(id = 'r1') {
  return {
    id,
    name: 'Push Day',
    position: 'Session 1 of 1',
    blocks: [
      { id: 'block1', type: 'single', exerciseIds: ['bench-press'], sets: 3, repMin: 8, repMax: 12, rest: 90, rir: 2, targetWeight: null },
    ],
  }
}

// Wraps renderHook so each call re-renders with a fresh state snapshot,
// mirroring how StoreProvider re-renders the hook after every dispatch.
function renderNotifications(initial) {
  let state = initial
  const view = renderHook(({ s }) => useWorkoutNotifications(s, []), { initialProps: { s: state } })
  function apply(action) {
    state = reducer(state, action)
    view.rerender({ s: state })
    return state
  }
  return { apply, getState: () => state }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useWorkoutNotifications — lifecycle (effect A)', () => {
  it('starts once when a workout begins and stops once when it ends', () => {
    const routine = sampleRoutine()
    const { apply } = renderNotifications(baseState({ routines: [routine], routineOrder: [routine.id] }))
    native.stopWorkout.mockClear() // mounting with no active workout calls stop() once, by design — isolate what follows

    apply({ type: 'START_WORKOUT', payload: { routineId: routine.id } })
    expect(native.startWorkout).toHaveBeenCalledTimes(1)
    expect(native.stopWorkout).not.toHaveBeenCalled()

    apply({ type: 'FINISH_WORKOUT', payload: { note: '' } })
    expect(native.stopWorkout).toHaveBeenCalledTimes(1)
  })

  it('DISCARD_WORKOUT and DELETE_ALL_DATA also stop it — every activeWorkout:null path is covered', () => {
    const routine = sampleRoutine()

    const discard = renderNotifications(baseState({ routines: [routine], routineOrder: [routine.id] }))
    native.stopWorkout.mockClear()
    discard.apply({ type: 'START_WORKOUT', payload: { routineId: routine.id } })
    discard.apply({ type: 'DISCARD_WORKOUT' })
    expect(native.stopWorkout).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()

    const wipe = renderNotifications(baseState({ routines: [routine], routineOrder: [routine.id] }))
    native.stopWorkout.mockClear()
    wipe.apply({ type: 'START_WORKOUT', payload: { routineId: routine.id } })
    wipe.apply({ type: 'DELETE_ALL_DATA' })
    expect(native.stopWorkout).toHaveBeenCalledTimes(1)
  })

  it('starts on mount when a workout is already active (persisted across a cold restart)', () => {
    const routine = sampleRoutine()
    const started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })

    renderNotifications(started)

    expect(native.startWorkout).toHaveBeenCalledTimes(1)
  })
})

describe('useWorkoutNotifications — content (effect B) is immune to keystrokes', () => {
  it('ten SET_SET_FIELD dispatches produce zero update calls', () => {
    const routine = sampleRoutine()
    const { apply } = renderNotifications(baseState({ routines: [routine], routineOrder: [routine.id] }))

    apply({ type: 'START_WORKOUT', payload: { routineId: routine.id } })
    native.updateWorkout.mockClear() // the start-of-workout render already fired one update; isolate the keystroke effect

    for (let i = 0; i < 10; i++) {
      apply({ type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'weight', value: String(60 + i) } })
    }

    expect(native.updateWorkout).not.toHaveBeenCalled()
  })

  it('does call update when a set is actually completed (setsDone changes)', () => {
    const routine = sampleRoutine()
    const { apply } = renderNotifications(baseState({ routines: [routine], routineOrder: [routine.id] }))
    apply({ type: 'START_WORKOUT', payload: { routineId: routine.id } })
    apply({ type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'weight', value: '60' } })
    apply({ type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'reps', value: '10' } })
    native.updateWorkout.mockClear()

    apply({ type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 0, setIndex: 0 } })

    expect(native.updateWorkout).toHaveBeenCalledTimes(1)
    expect(native.updateWorkout).toHaveBeenCalledWith(expect.objectContaining({ setsDone: 1, restUntil: expect.any(String) }))
  })
})

describe('useWorkoutNotifications — PR celebration (effect C)', () => {
  it('does not re-celebrate a PR already present on mount (cold reload mid-workout)', () => {
    const routine = sampleRoutine()
    let state = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
    state = { ...state, activeWorkout: { ...state.activeWorkout, lastPR: { exerciseIndex: 0, setIndex: 0 } } }

    renderNotifications(state)

    expect(native.notifyPR).not.toHaveBeenCalled()
  })

  it('celebrates a genuinely new PR exactly once', () => {
    const routine = sampleRoutine()
    const { apply } = renderNotifications(baseState({ routines: [routine], routineOrder: [routine.id] }))
    apply({ type: 'START_WORKOUT', payload: { routineId: routine.id } })
    apply({ type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'weight', value: '200' } })
    apply({ type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'reps', value: '10' } })

    apply({ type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 0, setIndex: 0 } })

    expect(native.notifyPR).toHaveBeenCalledTimes(1)
    expect(native.notifyPR).toHaveBeenCalledWith(expect.objectContaining({ exerciseIndex: 0, setIndex: 0 }))
  })
})

describe('useWorkoutNotifications — reminders (effect D)', () => {
  it('recomputes when settings.notifyReminders turns on, and stays quiet through unrelated dispatches', () => {
    const routine = sampleRoutine()
    const { apply } = renderNotifications(baseState({ routines: [routine], routineOrder: [routine.id] }))
    native.scheduleReminders.mockClear() // drop the initial mount call

    apply({ type: 'SET_SETTINGS', payload: { notifyReminders: true } })
    expect(native.scheduleReminders).toHaveBeenCalledTimes(1)

    native.scheduleReminders.mockClear()
    apply({ type: 'START_WORKOUT', payload: { routineId: routine.id } })
    apply({ type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'weight', value: '60' } })
    expect(native.scheduleReminders).not.toHaveBeenCalled()
  })
})
