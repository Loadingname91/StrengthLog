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
        blockId: 'block1',
        blockType: 'single',
        pairIndex: 0,
        pairSize: 1,
        target: '2x8-12',
        rest: 90,
        rir: null,
        targetWeight: null,
        sets: [
          { weight: '', reps: '', rir: null, done: false, isPR: false },
          { weight: '', reps: '', rir: null, done: false, isPR: false },
        ],
      },
    ],
  }
}

function renderWorkout() {
  testStore = createTestStore(baseState(twoSetWorkout()))
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
