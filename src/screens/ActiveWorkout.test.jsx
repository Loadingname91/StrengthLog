import { describe, it, expect, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { reducer } from '../state/reducer'
import { EXERCISES } from '../lib/exercises'
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
    return { state, dispatch: testStore.dispatch, exercises: EXERCISES }
  },
}))

function baseState(activeWorkout) {
  return {
    settings: { units: 'kg', theme: 'system', restDefault: 90, showRIR: false },
    user: { name: 'Athlete' },
    customExercises: [],
    exerciseNotes: {},
    exerciseTimerPresets: {},
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

function twoExerciseWorkout() {
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
        exerciseId: 'bench-press', exerciseIds: ['bench-press'], blockId: 'block1', blockType: 'single',
        target: '2x8-12', rir: null, targetWeight: null,
        sets: [{ weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: 0 }],
        restAfter: [null],
      },
      {
        exerciseId: 'barbell-row', exerciseIds: ['barbell-row'], blockId: 'block2', blockType: 'single',
        target: '2x8-12', rir: null, targetWeight: null,
        sets: [{ weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: 0 }],
        restAfter: [null],
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

describe('vertical exercise list', () => {
  it('renders every exercise name, not just the current one', () => {
    renderWorkout(twoExerciseWorkout())
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Barbell Row')).toBeInTheDocument()
  })

  it('only the current unit renders weight/reps inputs', () => {
    renderWorkout(twoExerciseWorkout())
    expect(weightInputs()).toHaveLength(1)
    expect(repsInputs()).toHaveLength(1)
  })

  it('clicking a later exercise\'s collapsed row expands it and collapses the previous one', () => {
    renderWorkout(twoExerciseWorkout())
    expect(testStore.getState().activeWorkout.currentIndex).toBe(0)

    fireEvent.click(screen.getByText('Barbell Row'))

    expect(testStore.getState().activeWorkout.currentIndex).toBe(1)
    // The expanded card no longer shows a target line for Bench Press —
    // only its collapsed row remains, proving navigation still works after
    // the chip strip was replaced.
    expect(screen.getAllByText('Bench Press')).toHaveLength(1)
    expect(weightInputs()).toHaveLength(1)
  })

  it('shows a set-count on a collapsed row and switches to done styling once complete', () => {
    const workout = twoExerciseWorkout()
    workout.exercises[1].sets[0] = { ...workout.exercises[1].sets[0], weight: '60', reps: '10', done: true }
    renderWorkout(workout)

    expect(screen.getByText('1/1 sets')).toBeInTheDocument()
  })
})

describe('swap exercise', () => {
  it('opens the exercise library, and picking a new exercise for an untouched unit swaps immediately', () => {
    renderWorkout(twoSetWorkout()) // untouched: no weight/reps logged yet

    fireEvent.click(screen.getByText('Swap'))
    expect(screen.getByText('Exercise Library')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Barbell Row'))

    expect(screen.queryByText('Exercise Library')).not.toBeInTheDocument()
    expect(testStore.getState().activeWorkout.exercises[0].exerciseId).toBe('barbell-row')
    expect(weightInputs()[0].value).toBe('')
  })

  it('shows a confirm sheet instead of swapping immediately once the unit has logged data', () => {
    renderWorkout(twoSetWorkout())
    fireEvent.change(weightInputs()[0], { target: { value: '60' } })

    fireEvent.click(screen.getByText('Swap'))
    fireEvent.click(screen.getByText('Barbell Row'))

    expect(screen.getByText('Swap this exercise?')).toBeInTheDocument()
    // Not swapped yet — still Bench Press, still holding the typed weight.
    expect(testStore.getState().activeWorkout.exercises[0].exerciseId).toBe('bench-press')

    // Two "Swap" buttons now exist — the card's own trigger, and the confirm
    // sheet's confirm button, which renders after it in the tree.
    fireEvent.click(screen.getAllByText('Swap').at(-1))

    expect(testStore.getState().activeWorkout.exercises[0].exerciseId).toBe('barbell-row')
    expect(weightInputs()[0].value).toBe('')
  })

  it('renders no Swap button on a superset card', () => {
    renderWorkout(supersetWorkout())
    expect(screen.queryByText('Swap')).not.toBeInTheDocument()
  })
})

describe('add exercise', () => {
  it('appends a new collapsed row after picking, without disturbing the current exercise', () => {
    renderWorkout(twoSetWorkout())

    fireEvent.click(screen.getByText('+ Add exercise'))
    expect(screen.getByText('Exercise Library')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Barbell Row'))

    expect(screen.queryByText('Exercise Library')).not.toBeInTheDocument()
    expect(testStore.getState().activeWorkout.exercises).toHaveLength(2)
    expect(testStore.getState().activeWorkout.currentIndex).toBe(0)
    // Still expanded on Bench Press (2 sets, per twoSetWorkout); Barbell Row
    // shows as a collapsed row, contributing no inputs of its own.
    expect(weightInputs()).toHaveLength(2)
    expect(screen.getByText('0/3 sets')).toBeInTheDocument()
  })
})

describe('quick timer', () => {
  it('shows preset chips seeded from exerciseTimerPresets for the targeted exercise', () => {
    const workout = twoSetWorkout()
    testStore = createTestStore({ ...baseState(workout), exerciseTimerPresets: { 'bench-press': [30, 60] } })
    render(
      <MemoryRouter>
        <ActiveWorkout />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Timer'))

    expect(screen.getByText('30s')).toBeInTheDocument()
    expect(screen.getByText('60s')).toBeInTheDocument()
  })

  it('counting a countdown down to completion and logging it sets durationSec, marks the set done, and never arms a rest countdown', () => {
    vi.useFakeTimers()
    try {
      const workout = twoSetWorkout()
      // Set 0 is already done, so the timer targets set 1 — whose
      // restAfter is null. Any non-null restUntil afterward could only come
      // from the sheet's own state, proving it never writes restUntil/
      // restTotalSec itself (it only ever dispatches SET_SET_FIELD/
      // TOGGLE_SET_DONE, same as a normal weight/reps completion).
      workout.exercises[0].sets[0] = { ...workout.exercises[0].sets[0], weight: '60', reps: '10', done: true }
      testStore = createTestStore({ ...baseState(workout), exerciseTimerPresets: { 'bench-press': [5] } })
      render(
        <MemoryRouter>
          <ActiveWorkout />
        </MemoryRouter>
      )

      fireEvent.click(screen.getByText('Timer'))
      fireEvent.click(screen.getByText('Start'))
      act(() => { vi.advanceTimersByTime(5000) })
      fireEvent.click(screen.getByText('Log 5s'))

      const aw = testStore.getState().activeWorkout
      expect(aw.exercises[0].sets[1].durationSec).toBe(5)
      expect(aw.exercises[0].sets[1].done).toBe(true)
      expect(aw.restUntil).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

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

describe('Notification "Finish" tap (Phase 9, NOTIF-15)', () => {
  it('opens the existing confirm sheet when sets are incomplete', () => {
    renderWorkout(twoSetWorkout())

    act(() => {
      testStore.dispatch({ type: 'SET_FINISH_REQUESTED', payload: true })
    })

    expect(screen.getByText('Finish with sets left?')).toBeInTheDocument()
    expect(testStore.getState().activeWorkout.finishRequested).toBe(false)
  })

  it('finishes directly, with no confirm sheet, when every set is already done', () => {
    const workout = twoSetWorkout()
    workout.exercises[0].sets = workout.exercises[0].sets.map((s) => ({ ...s, weight: '60', reps: '10', done: true }))
    renderWorkout(workout)

    act(() => {
      testStore.dispatch({ type: 'SET_FINISH_REQUESTED', payload: true })
    })

    expect(screen.queryByText('Finish with sets left?')).not.toBeInTheDocument()
    expect(testStore.getState().activeWorkout).toBeNull()
  })
})

describe('⋮ menu: restart and discard', () => {
  it('Restart clears every logged set but keeps the workout active', () => {
    const workout = twoSetWorkout()
    workout.exercises[0].sets[0] = { ...workout.exercises[0].sets[0], weight: '60', reps: '10', done: true }
    // RESTART_WORKOUT rebuilds from the routine, so it must be resolvable
    // in state — twoSetWorkout()'s routineId is 'r1'.
    const routine = {
      id: 'r1',
      name: 'Push Day',
      position: 'Session 1 of 1',
      blocks: [{ id: 'block1', type: 'single', exerciseIds: ['bench-press'], sets: 2, repMin: 8, repMax: 12, rest: 90, rir: null, targetWeight: null }],
    }
    testStore = createTestStore({ ...baseState(workout), routines: [routine] })
    render(
      <MemoryRouter>
        <ActiveWorkout />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('⋮'))
    fireEvent.click(screen.getByText('Restart workout'))
    fireEvent.click(screen.getByText('Restart'))

    const aw = testStore.getState().activeWorkout
    expect(aw).not.toBeNull()
    expect(aw.exercises[0].sets.every((s) => s.weight === '' && !s.done)).toBe(true)
  })

  it('Discard (after the hold) clears the active workout', () => {
    vi.useFakeTimers()
    try {
      renderWorkout(twoSetWorkout())

      fireEvent.click(screen.getByText('⋮'))
      fireEvent.click(screen.getByText('Discard workout'))
      fireEvent.pointerDown(screen.getByText('Discard'))
      act(() => { vi.advanceTimersByTime(1500) })

      expect(testStore.getState().activeWorkout).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
