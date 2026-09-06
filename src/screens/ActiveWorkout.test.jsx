import { describe, it, expect, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { reducer } from '../state/reducer'
import ActiveWorkout from './ActiveWorkout'

// A minimal external store (subscribe/getState/dispatch) bridging the real
// reducer into the mocked useStore() via useSyncExternalStore — the
// React-sanctioned way to read external mutable state reactively, so
// dispatching from inside ActiveWorkout re-renders it exactly like the real
// StoreProvider does, without any component mutating an outer variable
// during render.
function createTestStore(initialState) {
  let state = initialState
  const listeners = new Set()
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispatch: (action) => {
      state = reducer(state, action)
      listeners.forEach((l) => l())
    },
  }
}

let testStore

vi.mock('../state/StoreContext', () => ({
  useStore: () => {
    const state = useSyncExternalStore(testStore.subscribe, testStore.getState)
    return { state, dispatch: testStore.dispatch }
  },
}))

function baseState(activeWorkout) {
  return {
    settings: { units: 'kg', theme: 'system', restDefault: 90, showRIR: false },
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
    activeWorkout,
    lastImportedAt: null,
    createdAt: '2026-01-01',
  }
}

function twoSetWorkout() {
  return {
    id: 'w1',
    routineId: 'r1',
    routineName: 'Push Day',
    startedAt: new Date().toISOString(),
    currentIndex: 0,
    restUntil: null,
    restExerciseIndex: null,
    exercises: [
      {
        exerciseId: 'bench-press',
        exerciseIds: ['bench-press'],
        blockId: 'block1',
        blockType: 'single',
        target: '2x8-12',
        rir: null,
        targetWeight: null,
        sets: [
          { weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: 0 },
          { weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: 0 },
        ],
        restAfter: [90, null],
      },
    ],
  }
}

function supersetWorkout() {
  return {
    id: 'w1',
    routineId: 'r1',
    routineName: 'Push Day',
    startedAt: new Date().toISOString(),
    currentIndex: 0,
    restUntil: null,
    restExerciseIndex: null,
    exercises: [
      {
        exerciseIds: ['bench-press', 'barbell-row'],
        blockId: 'block1',
        blockType: 'superset',
        target: '2x8-12',
        rir: null,
        targetWeight: null,
        sets: [
          { weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: 0 },
          { weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: 1 },
        ],
        restAfter: [null, 120],
      },
    ],
  }
}

// Two sets sharing the same rest duration — the shape that used to fool the
// RestRow "active" test, which compared aw.restTotalSec === restSeconds (a
// duration match) instead of which exercise/set actually started the rest.
function threeSetSameRestWorkout() {
  return {
    id: 'w1',
    routineId: 'r1',
    routineName: 'Push Day',
    startedAt: new Date().toISOString(),
    currentIndex: 0,
    restUntil: null,
    restExerciseIndex: null,
    restSetIndex: null,
    restTotalSec: null,
    exercises: [
      {
        exerciseId: 'bench-press',
        exerciseIds: ['bench-press'],
        blockId: 'block1',
        blockType: 'single',
        target: '3x8-12',
        rir: null,
        targetWeight: null,
        sets: [
          { weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: 0 },
          { weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: 0 },
          { weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: 0 },
        ],
        restAfter: [30, 30, null],
      },
    ],
  }
}

function renderWorkout(activeWorkout = twoSetWorkout()) {
  testStore = createTestStore(baseState(activeWorkout))
  return render(
    <MemoryRouter>
      <ActiveWorkout />
    </MemoryRouter>
  )
}

function weightInputs() {
  return screen.getAllByPlaceholderText('—').filter((el) => el.getAttribute('inputmode') === 'decimal')
}
function repsInputs() {
  return screen.getAllByPlaceholderText('—').filter((el) => el.getAttribute('inputmode') === 'numeric')
}

describe('ActiveWorkout fast set entry', () => {
  it('confirming weight (blur) focuses that set\'s reps field', () => {
    renderWorkout()
    fireEvent.change(weightInputs()[0], { target: { value: '60' } })
    fireEvent.blur(weightInputs()[0])

    expect(document.activeElement).toBe(repsInputs()[0])
  })

  it('confirming reps focuses the next set\'s weight field', () => {
    renderWorkout()
    fireEvent.change(weightInputs()[0], { target: { value: '60' } })
    fireEvent.change(repsInputs()[0], { target: { value: '10' } })
    fireEvent.blur(repsInputs()[0])

    expect(document.activeElement).toBe(weightInputs()[1])
  })

  it('auto-marks a set done once both weight and reps are valid', () => {
    renderWorkout()
    fireEvent.change(weightInputs()[0], { target: { value: '60' } })
    fireEvent.blur(weightInputs()[0])
    fireEvent.change(repsInputs()[0], { target: { value: '10' } })
    fireEvent.blur(repsInputs()[0])

    expect(testStore.getState().activeWorkout.exercises[0].sets[0].done).toBe(true)
  })

  it('does not auto-mark done when only one field is filled', () => {
    renderWorkout()
    fireEvent.change(weightInputs()[0], { target: { value: '60' } })
    fireEvent.blur(weightInputs()[0])

    expect(testStore.getState().activeWorkout.exercises[0].sets[0].done).toBe(false)
  })

  it('a second consecutive auto-advance does not re-toggle a set already marked done (regression: the focus shift genuinely blurs a field that really held focus, re-entering its own confirm handler)', () => {
    renderWorkout()
    // Set 0: fill both fields via confirm (weight's real focus-shift to reps
    // means reps genuinely holds focus afterward).
    fireEvent.change(weightInputs()[0], { target: { value: '60' } })
    fireEvent.blur(weightInputs()[0])
    fireEvent.change(repsInputs()[0], { target: { value: '10' } })
    fireEvent.blur(repsInputs()[0])

    expect(testStore.getState().activeWorkout.exercises[0].sets[0].done).toBe(true)

    // Set 1: same sequence — reps[0] genuinely held focus from the previous
    // advance, so confirming reps[1] triggers a real blur cascade back onto
    // reps[0] as focus moves elsewhere; that must not re-toggle set 0.
    fireEvent.change(weightInputs()[1], { target: { value: '65' } })
    fireEvent.blur(weightInputs()[1])
    fireEvent.change(repsInputs()[1], { target: { value: '8' } })
    fireEvent.blur(repsInputs()[1])

    expect(testStore.getState().activeWorkout.exercises[0].sets[0].done).toBe(true)
    expect(testStore.getState().activeWorkout.exercises[0].sets[1].done).toBe(true)
  })
})

describe('ActiveWorkout merged superset (Phase 6)', () => {
  it('renders both exercise names and a single round grouping, no per-exercise tabs', () => {
    renderWorkout(supersetWorkout())

    expect(screen.getAllByText('Bench Press + Barbell Row').length).toBeGreaterThan(0)
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Barbell Row')).toBeInTheDocument()
  })

  it('does not show the single-exercise-only help ("?") button', () => {
    renderWorkout(supersetWorkout())
    expect(screen.queryByText('?')).not.toBeInTheDocument()
  })

  it('SUPER-02: confirming the first exercise\'s reps auto-advances focus into the second exercise\'s weight, within the same round', () => {
    renderWorkout(supersetWorkout())

    fireEvent.change(weightInputs()[0], { target: { value: '60' } })
    fireEvent.change(repsInputs()[0], { target: { value: '10' } })
    fireEvent.blur(repsInputs()[0])

    expect(document.activeElement).toBe(weightInputs()[1])
    // Rest is only authored after the round's second exercise — completing
    // just the first must not start it.
    expect(testStore.getState().activeWorkout.restUntil).toBeNull()
  })

  it('rest starts only once the round\'s second exercise is also completed', () => {
    renderWorkout(supersetWorkout())

    fireEvent.change(weightInputs()[0], { target: { value: '60' } })
    fireEvent.change(repsInputs()[0], { target: { value: '10' } })
    fireEvent.blur(repsInputs()[0])
    fireEvent.change(weightInputs()[1], { target: { value: '50' } })
    fireEvent.change(repsInputs()[1], { target: { value: '10' } })
    fireEvent.blur(repsInputs()[1])

    const aw = testStore.getState().activeWorkout
    expect(aw.restUntil).not.toBeNull()
    expect(aw.restTotalSec).toBe(120)
  })
})

describe('RestRow active state', () => {
  it('only the set that actually started the current rest shows as active, not every set with the same duration', () => {
    // Fixed clock: the component's mount-time `now` and the reducer's
    // Date.now() at TOGGLE_SET_DONE must agree exactly, or the countdown
    // label's remaining-seconds figure becomes a timing-dependent guess.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0))
    try {
      renderWorkout(threeSetSameRestWorkout())

      fireEvent.change(weightInputs()[0], { target: { value: '60' } })
      fireEvent.change(repsInputs()[0], { target: { value: '10' } })
      fireEvent.blur(repsInputs()[0])
      fireEvent.change(weightInputs()[1], { target: { value: '60' } })
      fireEvent.change(repsInputs()[1], { target: { value: '10' } })
      fireEvent.blur(repsInputs()[1])

      // Both rest rows share a 30s duration. Completing set 2 restarts the
      // timer for position 1 — set 1's now-finished rest must not relight.
      expect(screen.getByText('Rest — 30s')).toBeInTheDocument()
      expect(screen.getByText('Rest — 0:30 left')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Notification fallback banner (Phase 8, NOTIF-13)', () => {
  it('shows the banner when notifFallback is set, hides it otherwise', () => {
    renderWorkout({ ...twoSetWorkout(), notifFallback: true })
    expect(screen.getByText(/Notifications are blocked/)).toBeInTheDocument()
  })

  it('does not render the banner when notifFallback is absent', () => {
    renderWorkout(twoSetWorkout())
    expect(screen.queryByText(/Notifications are blocked/)).not.toBeInTheDocument()
  })
})
