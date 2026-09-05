import { describe, it, expect } from 'vitest'
import { reducer } from './reducer'

function baseState(overrides = {}) {
  return {
    settings: { units: 'kg', theme: 'system', restDefault: 90, showRIR: true },
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

describe('DELETE_ALL_DATA', () => {
  it('clears sessions/measurements/goals/lastFinishedSession but keeps customExercises and routines', () => {
    const routine = sampleRoutine()
    const state = baseState({
      routines: [routine],
      routineOrder: [routine.id],
      customExercises: [{ id: 'custom-1', name: 'My Exercise' }],
      sessions: [{ id: 's1' }],
      measurements: [{ id: 'm1' }],
      goals: [{ id: 'g1' }],
      lastFinishedSession: { id: 's1' },
      activeWorkout: { id: 'w1' },
    })

    const next = reducer(state, { type: 'DELETE_ALL_DATA' })

    expect(next.sessions).toEqual([])
    expect(next.measurements).toEqual([])
    expect(next.goals).toEqual([])
    expect(next.lastFinishedSession).toBeNull()
    expect(next.activeWorkout).toBeNull()
    // Locks in the Phase 1 CR-02 fix — these must survive a delete-all.
    expect(next.customExercises).toEqual(state.customExercises)
    expect(next.routines).toEqual(state.routines)
    expect(next.routineOrder).toEqual(state.routineOrder)
  })
})

describe('START_WORKOUT', () => {
  it('builds an active workout from the routine', () => {
    const routine = sampleRoutine()
    const state = baseState({ routines: [routine], routineOrder: [routine.id] })

    const next = reducer(state, { type: 'START_WORKOUT', payload: { routineId: routine.id } })

    expect(next.activeWorkout).not.toBeNull()
    expect(next.activeWorkout.routineId).toBe(routine.id)
    expect(next.activeWorkout.currentIndex).toBe(0)
    expect(next.activeWorkout.exercises).toHaveLength(1)
    expect(next.activeWorkout.exercises[0].exerciseId).toBe('bench-press')
    expect(next.activeWorkout.exercises[0].sets).toHaveLength(3)
  })

  it('never overwrites an already-in-progress workout (Phase 3 QA fix)', () => {
    const routine = sampleRoutine()
    const existingWorkout = { id: 'existing-workout', routineId: routine.id, currentIndex: 2 }
    const state = baseState({ routines: [routine], routineOrder: [routine.id], activeWorkout: existingWorkout })

    const next = reducer(state, { type: 'START_WORKOUT', payload: { routineId: routine.id } })

    expect(next).toBe(state)
    expect(next.activeWorkout).toBe(existingWorkout)
  })
})

describe('FINISH_WORKOUT', () => {
  it('appends a session, clears activeWorkout, and advances sequenceIndex', () => {
    const routineA = sampleRoutine('r1')
    const routineB = sampleRoutine('r2')
    const activeWorkout = {
      id: 'w1',
      routineId: 'r1',
      routineName: 'Push Day',
      startedAt: '2026-01-01T10:00:00.000Z',
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
          target: '3x8-12',
          rest: 90,
          rir: 2,
          sets: [{ weight: '60', reps: '10', rir: 2, done: true, isPR: false }],
        },
      ],
    }
    const state = baseState({
      routines: [routineA, routineB],
      routineOrder: ['r1', 'r2'],
      sequenceIndex: 0,
      activeWorkout,
    })

    const next = reducer(state, { type: 'FINISH_WORKOUT', payload: { note: '' } })

    expect(next.activeWorkout).toBeNull()
    expect(next.sessions).toHaveLength(1)
    expect(next.sessions[0].routineId).toBe('r1')
    expect(next.sessions[0].entries).toHaveLength(1)
    expect(next.lastFinishedSession).toBe(next.sessions[0])
    // Sequence advances to the next routine (wraps via modulo).
    expect(next.sequenceIndex).toBe(1)
  })
})
