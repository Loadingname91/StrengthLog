import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkoutNotifications } from './useWorkoutNotifications'
import { reducer } from './reducer'

vi.mock('../lib/nativeNotifications', () => ({
  ensureChannels: vi.fn(),
  requestNotificationPermission: vi.fn(),
  checkNotificationPermission: vi.fn(),
  startWorkout: vi.fn(() => Promise.resolve(false)),
  updateWorkout: vi.fn(),
  stopWorkout: vi.fn(),
  notifyPR: vi.fn(),
  scheduleReminders: vi.fn(),
  drainPendingActions: vi.fn(),
  onWorkoutAction: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  ackAction: vi.fn(),
}))
import * as native from '../lib/nativeNotifications'

function baseState(overrides = {}) {
  return {
    settings: { units: 'kg', theme: 'system', restDefault: 90, showRIR: true, notifyRestDone: true, notifyOngoing: true, notifyPR: true, notifyReminders: false, reminderTime: '18:00' },
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
// mirroring how StoreProvider re-renders the hook after every dispatch. The
// hook's own dispatch calls (effect A's fallback flag, effect E's drained
// actions) are wired through this exact same apply/rerender loop, so they
// behave identically to externally-applied test actions.
function renderNotifications(initial) {
  let state = initial
  function dispatch(action) {
    state = reducer(state, action)
    view.rerender({ s: state })
  }
  const view = renderHook(({ s }) => useWorkoutNotifications(s, dispatch, []), { initialProps: { s: state } })
  function apply(action) {
    dispatch(action)
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

  it('dispatches a fallback flag once startWorkout resolves (denied permission or the setting turned off)', async () => {
    const routine = sampleRoutine()
    native.startWorkout.mockResolvedValueOnce(true)
    const { apply, getState } = renderNotifications(baseState({ routines: [routine], routineOrder: [routine.id] }))

    await act(async () => {
      apply({ type: 'START_WORKOUT', payload: { routineId: routine.id } })
    })

    expect(getState().activeWorkout.notifFallback).toBe(true)
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

describe('useWorkoutNotifications — pending action drain (effect E)', () => {
  it('drains once and subscribes to the live event once, on mount', () => {
    const routine = sampleRoutine()
    renderNotifications(baseState({ routines: [routine], routineOrder: [routine.id] }))

    expect(native.drainPendingActions).toHaveBeenCalledTimes(1)
    expect(native.onWorkoutAction).toHaveBeenCalledTimes(1)
  })

  it('applies a drained action for the active workout, and drops one for a different workoutId', async () => {
    const routine = sampleRoutine()
    let started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
    const restUntil = new Date(Date.now() + 60_000).toISOString()
    started = { ...started, activeWorkout: { ...started.activeWorkout, restUntil, restTotalSec: 90 } }
    const workoutId = started.activeWorkout.id

    // Mirrors the real drainPendingActions' shape: an await (there, the
    // native getPending() call) before apply() ever runs, so these calls
    // land as a microtask after the initial mount — not synchronously
    // inside it, when the render-hook view handle doesn't exist yet.
    native.drainPendingActions.mockImplementationOnce(async (apply) => {
      await Promise.resolve()
      apply({ workoutId: 'some-other-workout-id', type: 'REST_ADJUST', payload: 15 })
      apply({ workoutId, type: 'REST_ADJUST', payload: 15 })
    })

    let harness
    await act(async () => {
      harness = renderNotifications(started)
    })

    // 90 + 15 once: proves the mismatched workoutId was dropped (it would
    // be 105 either way if dropped, or 120 if it had wrongly applied twice).
    expect(harness.getState().activeWorkout.restTotalSec).toBe(105)
  })

  it('acks and applies a live workoutAction event the same way', () => {
    const routine = sampleRoutine()
    let started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
    started = { ...started, activeWorkout: { ...started.activeWorkout, restUntil: new Date(Date.now() + 60_000).toISOString(), restTotalSec: 90 } }
    const workoutId = started.activeWorkout.id

    const { getState } = renderNotifications(started)
    const liveHandler = native.onWorkoutAction.mock.calls[0][0]

    liveHandler({ id: 'a1', workoutId, type: 'REST_SKIP', payload: 0 })

    expect(getState().activeWorkout.restUntil).toBeNull()
    expect(native.ackAction).toHaveBeenCalledWith('a1')
  })
})
