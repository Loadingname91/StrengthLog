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
          exerciseIds: ['bench-press'],
          blockId: 'block1',
          blockType: 'single',
          target: '3x8-12',
          rir: 2,
          sets: [{ weight: '60', reps: '10', rir: 2, done: true, isPR: false, exerciseIndex: 0 }],
          restAfter: [null],
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

function supersetRoutine() {
  return {
    id: 'r1',
    name: 'Push Day',
    position: 'Session 1 of 1',
    blocks: [
      { id: 'block1', type: 'superset', exerciseIds: ['bench-press', 'barbell-row'], sets: 2, repMin: 8, repMax: 12, rest: 120, rir: 2, targetWeight: null },
    ],
  }
}

describe('Superset runtime (Phase 6)', () => {
  it('START_WORKOUT produces one merged unit with an interleaved sets array and rest only after each round', () => {
    const routine = supersetRoutine()
    const state = baseState({ routines: [routine], routineOrder: [routine.id] })

    const next = reducer(state, { type: 'START_WORKOUT', payload: { routineId: routine.id } })

    expect(next.activeWorkout.exercises).toHaveLength(1) // one unit, not two
    const unit = next.activeWorkout.exercises[0]
    expect(unit.blockType).toBe('superset')
    expect(unit.exerciseIds).toEqual(['bench-press', 'barbell-row'])
    // 2 rounds x 2 exercises = 4 sets, alternating exerciseIndex 0,1,0,1
    expect(unit.sets.map((s) => s.exerciseIndex)).toEqual([0, 1, 0, 1])
    // Rest only after each round's second exercise (index 1), not after index 0, not after the last set.
    expect(unit.restAfter).toEqual([null, 120, null, null])
  })

  it('TOGGLE_SET_DONE does not start rest after the first exercise in a round, but does after the second', () => {
    const routine = supersetRoutine()
    const started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
    const aw = started.activeWorkout
    const withValues = {
      ...started,
      activeWorkout: {
        ...aw,
        exercises: [{ ...aw.exercises[0], sets: aw.exercises[0].sets.map((s) => ({ ...s, weight: '60', reps: '10' })) }],
      },
    }

    const afterFirst = reducer(withValues, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 0, setIndex: 0 } })
    expect(afterFirst.activeWorkout.restUntil).toBeNull()

    const afterSecond = reducer(afterFirst, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 0, setIndex: 1 } })
    expect(afterSecond.activeWorkout.restUntil).not.toBeNull()
    expect(afterSecond.activeWorkout.restTotalSec).toBe(120)
  })

  it('FINISH_WORKOUT produces one session entry per exercise, each with only that exercise\'s own sets', () => {
    const routine = supersetRoutine()
    const started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
    const unit = started.activeWorkout.exercises[0]
    const loggedSets = unit.sets.map((s, i) => ({ ...s, weight: String(60 + i), reps: '10', done: true }))
    const state = { ...started, activeWorkout: { ...started.activeWorkout, exercises: [{ ...unit, sets: loggedSets }] } }

    const next = reducer(state, { type: 'FINISH_WORKOUT', payload: { note: '' } })

    expect(next.sessions).toHaveLength(1)
    expect(next.sessions[0].entries).toHaveLength(2)
    const benchEntry = next.sessions[0].entries.find((e) => e.exerciseId === 'bench-press')
    const rowEntry = next.sessions[0].entries.find((e) => e.exerciseId === 'barbell-row')
    expect(benchEntry.sets).toHaveLength(2)
    expect(rowEntry.sets).toHaveLength(2)
    // exerciseIndex 0 sets got weights 60,62; exerciseIndex 1 got 61,63.
    expect(benchEntry.sets.map((s) => s.weight)).toEqual([60, 62])
    expect(rowEntry.sets.map((s) => s.weight)).toEqual([61, 63])
  })

  it('ADD_SET on a superset unit appends one full round (one set per exercise), not just one set', () => {
    const routine = supersetRoutine()
    const started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })

    const next = reducer(started, { type: 'ADD_SET', payload: { exerciseIndex: 0 } })

    const unit = next.activeWorkout.exercises[0]
    expect(unit.sets).toHaveLength(6) // was 4, +2 for a full round
    expect(unit.sets.map((s) => s.exerciseIndex)).toEqual([0, 1, 0, 1, 0, 1])
    expect(unit.restAfter).toHaveLength(6)
  })

  it('REMOVE_SET on a superset unit removes one full round, and refuses to go below one round', () => {
    const routine = supersetRoutine()
    const started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })

    const afterOneRemove = reducer(started, { type: 'REMOVE_SET', payload: { exerciseIndex: 0 } })
    expect(afterOneRemove.activeWorkout.exercises[0].sets).toHaveLength(2) // one round left

    const afterSecondRemove = reducer(afterOneRemove, { type: 'REMOVE_SET', payload: { exerciseIndex: 0 } })
    expect(afterSecondRemove.activeWorkout.exercises[0].sets).toHaveLength(2) // guard: can't go below one round
  })
})
