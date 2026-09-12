import { describe, it, expect, vi } from 'vitest'
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

  function workoutWithOneSet(setOverrides) {
    return {
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
          sets: [{ weight: '', reps: '', rir: null, done: true, isPR: false, exerciseIndex: 0, ...setOverrides }],
          restAfter: [null],
        },
      ],
    }
  }

  it('carries durationSec through onto the session entry', () => {
    const routine = sampleRoutine('r1')
    const state = baseState({ routines: [routine], routineOrder: [routine.id], activeWorkout: workoutWithOneSet({ weight: '60', reps: '10', durationSec: 45 }) })

    const next = reducer(state, { type: 'FINISH_WORKOUT', payload: { note: '' } })

    expect(next.sessions[0].entries[0].sets[0].durationSec).toBe(45)
  })

  it('keeps a done, duration-only set (no weight/reps) instead of silently dropping it', () => {
    const routine = sampleRoutine('r1')
    const state = baseState({ routines: [routine], routineOrder: [routine.id], activeWorkout: workoutWithOneSet({ durationSec: 60 }) })

    const next = reducer(state, { type: 'FINISH_WORKOUT', payload: { note: '' } })

    expect(next.sessions[0].entries).toHaveLength(1)
    expect(next.sessions[0].entries[0].sets[0]).toMatchObject({ weight: 0, reps: 0, durationSec: 60 })
  })

  it('still drops a done set with neither weight/reps nor a duration', () => {
    const routine = sampleRoutine('r1')
    const state = baseState({ routines: [routine], routineOrder: [routine.id], activeWorkout: workoutWithOneSet({}) })

    const next = reducer(state, { type: 'FINISH_WORKOUT', payload: { note: '' } })

    expect(next.sessions[0].entries).toHaveLength(0)
  })
})

describe('ADD_TIMER_PRESET / REMOVE_TIMER_PRESET', () => {
  it('adds a preset, sorted ascending', () => {
    const state = baseState({ exerciseTimerPresets: { plank: [60] } })
    const next = reducer(state, { type: 'ADD_TIMER_PRESET', payload: { exerciseId: 'plank', seconds: 30 } })
    expect(next.exerciseTimerPresets.plank).toEqual([30, 60])
  })

  it('dedupes an already-present seconds value', () => {
    const state = baseState({ exerciseTimerPresets: { plank: [60] } })
    const next = reducer(state, { type: 'ADD_TIMER_PRESET', payload: { exerciseId: 'plank', seconds: 60 } })
    expect(next).toBe(state)
  })

  it('caps at 4 presets per exercise, dropping the longest', () => {
    const state = baseState({ exerciseTimerPresets: { plank: [30, 45, 60, 90] } })
    const next = reducer(state, { type: 'ADD_TIMER_PRESET', payload: { exerciseId: 'plank', seconds: 20 } })
    expect(next.exerciseTimerPresets.plank).toEqual([20, 30, 45, 60])
  })

  it('works against state where exerciseTimerPresets is entirely omitted', () => {
    const state = baseState()
    delete state.exerciseTimerPresets
    const next = reducer(state, { type: 'ADD_TIMER_PRESET', payload: { exerciseId: 'plank', seconds: 60 } })
    expect(next.exerciseTimerPresets.plank).toEqual([60])
  })

  it('removes a preset', () => {
    const state = baseState({ exerciseTimerPresets: { plank: [30, 60] } })
    const next = reducer(state, { type: 'REMOVE_TIMER_PRESET', payload: { exerciseId: 'plank', seconds: 30 } })
    expect(next.exerciseTimerPresets.plank).toEqual([60])
  })

  it('deletes the exercise key entirely once its last preset is removed', () => {
    const state = baseState({ exerciseTimerPresets: { plank: [60] } })
    const next = reducer(state, { type: 'REMOVE_TIMER_PRESET', payload: { exerciseId: 'plank', seconds: 60 } })
    expect(next.exerciseTimerPresets).not.toHaveProperty('plank')
  })
})

function sessionWithSet(id, date, exerciseId, weight, reps) {
  return {
    id,
    routineId: 'r1',
    routineName: 'Push Day',
    date,
    startedAt: `${date}T10:00:00.000Z`,
    finishedAt: `${date}T10:30:00.000Z`,
    durationSec: 1800,
    note: '',
    entries: [{ exerciseId, blockId: 'block1', sets: [{ weight, reps, rir: 2, isPR: weight * reps > 0 }] }],
    volume: weight * reps,
    prCount: 0,
  }
}

describe('DELETE_SESSION', () => {
  it('removes the session and clears lastFinishedSession only on a matching id', () => {
    const s1 = sessionWithSet('s1', '2026-01-01', 'bench-press', 60, 10)
    const s2 = sessionWithSet('s2', '2026-01-02', 'bench-press', 40, 10)
    const state = baseState({ sessions: [s1, s2], lastFinishedSession: s1 })

    const next = reducer(state, { type: 'DELETE_SESSION', payload: 's1' })

    expect(next.sessions.map((s) => s.id)).toEqual(['s2'])
    expect(next.lastFinishedSession).toBeNull()
  })

  it('leaves lastFinishedSession untouched when the deleted session is not it', () => {
    const s1 = sessionWithSet('s1', '2026-01-01', 'bench-press', 60, 10)
    const s2 = sessionWithSet('s2', '2026-01-02', 'bench-press', 40, 10)
    const state = baseState({ sessions: [s1, s2], lastFinishedSession: s2 })

    const next = reducer(state, { type: 'DELETE_SESSION', payload: 's1' })

    expect(next.lastFinishedSession).toBe(s2)
  })

  it('is a no-op (aside from PR recompute) when the id is unknown', () => {
    const s1 = sessionWithSet('s1', '2026-01-01', 'bench-press', 60, 10)
    const state = baseState({ sessions: [s1] })

    const next = reducer(state, { type: 'DELETE_SESSION', payload: 'nope' })

    expect(next.sessions).toHaveLength(1)
    expect(next.sessions[0].id).toBe('s1')
  })

  it('recomputes PR flags across the remaining sessions after deleting an earlier one', () => {
    // s1 (earliest, biggest lift) is the PR; s2 loses to it. Deleting s1
    // should promote s2's set to a PR.
    const s1 = sessionWithSet('s1', '2026-01-01', 'bench-press', 100, 5)
    const s2 = sessionWithSet('s2', '2026-01-02', 'bench-press', 60, 10)
    s1.entries[0].sets[0].isPR = true
    s1.prCount = 1
    s2.entries[0].sets[0].isPR = false
    s2.prCount = 0
    const state = baseState({ sessions: [s1, s2] })

    const next = reducer(state, { type: 'DELETE_SESSION', payload: 's1' })

    expect(next.sessions).toHaveLength(1)
    expect(next.sessions[0].entries[0].sets[0].isPR).toBe(true)
    expect(next.sessions[0].prCount).toBe(1)
  })
})

describe('RESTART_WORKOUT', () => {
  it('rebuilds the active workout from its routine with every set blank', () => {
    const routine = sampleRoutine()
    const started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
    const logged = reducer(started, { type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'weight', value: '60' } })

    const restarted = reducer(logged, { type: 'RESTART_WORKOUT' })

    expect(restarted.activeWorkout).not.toBeNull()
    expect(restarted.activeWorkout.id).not.toBe(logged.activeWorkout.id)
    expect(restarted.activeWorkout.exercises[0].sets.every((s) => s.weight === '' && !s.done)).toBe(true)
  })

  it('is a no-op when there is no active workout', () => {
    const state = baseState()
    const next = reducer(state, { type: 'RESTART_WORKOUT' })
    expect(next).toBe(state)
  })

  it('is a no-op when the active workout\'s routine no longer exists', () => {
    const activeWorkout = { id: 'w1', routineId: 'deleted-routine', exercises: [] }
    const state = baseState({ activeWorkout })
    const next = reducer(state, { type: 'RESTART_WORKOUT' })
    expect(next).toBe(state)
  })
})

describe('SWAP_EXERCISE', () => {
  function started() {
    const routine = sampleRoutine()
    return reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
  }

  it('clears weight/reps/rir/done/isPR but preserves set count and restAfter', () => {
    const logged = reducer(started(), { type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'weight', value: '60' } })
    const withDone = reducer(logged, { type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'rir', value: 2 } })

    const swapped = reducer(withDone, { type: 'SWAP_EXERCISE', payload: { exerciseIndex: 0, exerciseId: 'incline-db-press' } })

    const unit = swapped.activeWorkout.exercises[0]
    expect(unit.sets).toHaveLength(3)
    expect(unit.restAfter).toEqual(withDone.activeWorkout.exercises[0].restAfter)
    expect(unit.sets.every((s) => s.weight === '' && s.reps === '' && s.rir === null && !s.done && !s.isPR)).toBe(true)
  })

  it('updates both exerciseId and exerciseIds, so a session entry logged after the swap is never keyed undefined', () => {
    const swapped = reducer(started(), { type: 'SWAP_EXERCISE', payload: { exerciseIndex: 0, exerciseId: 'incline-db-press' } })
    expect(swapped.activeWorkout.exercises[0].exerciseId).toBe('incline-db-press')
    expect(swapped.activeWorkout.exercises[0].exerciseIds).toEqual(['incline-db-press'])

    const logged = reducer(swapped, { type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'weight', value: '40' } })
    const withReps = reducer(logged, { type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'reps', value: '10' } })
    const done = reducer(withReps, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 0, setIndex: 0 } })
    const finished = reducer(done, { type: 'FINISH_WORKOUT', payload: { note: '' } })

    expect(finished.sessions).toHaveLength(1)
    expect(finished.sessions[0].entries.every((e) => e.exerciseId !== undefined)).toBe(true)
    expect(finished.sessions[0].entries[0].exerciseId).toBe('incline-db-press')
  })

  it('nulls targetWeight; preserves target, rir, and blockId', () => {
    const withTarget = { ...started() }
    withTarget.activeWorkout = { ...withTarget.activeWorkout, exercises: [{ ...withTarget.activeWorkout.exercises[0], targetWeight: 60 }] }

    const swapped = reducer(withTarget, { type: 'SWAP_EXERCISE', payload: { exerciseIndex: 0, exerciseId: 'incline-db-press' } })

    const unit = swapped.activeWorkout.exercises[0]
    expect(unit.targetWeight).toBeNull()
    expect(unit.target).toBe(withTarget.activeWorkout.exercises[0].target)
    expect(unit.rir).toBe(withTarget.activeWorkout.exercises[0].rir)
    expect(unit.blockId).toBe(withTarget.activeWorkout.exercises[0].blockId)
  })

  it('clears a running rest and lastPR only when they belong to the swapped exercise', () => {
    const logged = reducer(started(), { type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'weight', value: '60' } })
    const withReps = reducer(logged, { type: 'SET_SET_FIELD', payload: { exerciseIndex: 0, setIndex: 0, field: 'reps', value: '10' } })
    const resting = reducer(withReps, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 0, setIndex: 0 } })
    expect(resting.activeWorkout.restUntil).not.toBeNull()
    expect(resting.activeWorkout.lastPR).not.toBeNull()

    const swapped = reducer(resting, { type: 'SWAP_EXERCISE', payload: { exerciseIndex: 0, exerciseId: 'incline-db-press' } })
    expect(swapped.activeWorkout.restUntil).toBeNull()
    expect(swapped.activeWorkout.restExerciseIndex).toBeNull()
    expect(swapped.activeWorkout.restSetIndex).toBeNull()
    expect(swapped.activeWorkout.restTotalSec).toBeNull()
    expect(swapped.activeWorkout.lastPR).toBeNull()
  })

  it('is a no-op when swapping to the same exercise already in that slot', () => {
    const state = started()
    const next = reducer(state, { type: 'SWAP_EXERCISE', payload: { exerciseIndex: 0, exerciseId: 'bench-press' } })
    expect(next).toBe(state)
  })

  it('is a no-op on a superset unit', () => {
    const routine = supersetRoutine()
    const state = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
    const next = reducer(state, { type: 'SWAP_EXERCISE', payload: { exerciseIndex: 0, exerciseId: 'incline-db-press' } })
    expect(next).toBe(state)
  })

  it('is a no-op when there is no active workout', () => {
    const state = baseState()
    const next = reducer(state, { type: 'SWAP_EXERCISE', payload: { exerciseIndex: 0, exerciseId: 'incline-db-press' } })
    expect(next).toBe(state)
  })
})

describe('ADD_EXERCISE', () => {
  function started() {
    const routine = sampleRoutine()
    return reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
  }

  it('appends a new unit without disturbing the existing ones or positional pointers', () => {
    const state = started()
    const firstUnit = state.activeWorkout.exercises[0]

    const next = reducer(state, { type: 'ADD_EXERCISE', payload: { exerciseId: 'incline-db-press' } })

    expect(next.activeWorkout.exercises).toHaveLength(2)
    expect(next.activeWorkout.exercises[0]).toBe(firstUnit)
    expect(next.activeWorkout.currentIndex).toBe(state.activeWorkout.currentIndex)
  })

  it('builds a 3-set unit with matching restAfter length and both id fields set', () => {
    const next = reducer(started(), { type: 'ADD_EXERCISE', payload: { exerciseId: 'incline-db-press' } })
    const unit = next.activeWorkout.exercises[1]

    expect(unit.sets).toHaveLength(3)
    expect(unit.restAfter).toHaveLength(3)
    expect(unit.target).toBe('3×8-12')
    expect(unit.exerciseId).toBe('incline-db-press')
    expect(unit.exerciseIds).toEqual(['incline-db-press'])
  })

  it('the new unit does not read as already complete', () => {
    const next = reducer(started(), { type: 'ADD_EXERCISE', payload: { exerciseId: 'incline-db-press' } })
    const unit = next.activeWorkout.exercises[1]
    expect(unit.sets.every((s) => s.done)).toBe(false)
  })

  it('is a no-op when there is no active workout', () => {
    const state = baseState()
    const next = reducer(state, { type: 'ADD_EXERCISE', payload: { exerciseId: 'incline-db-press' } })
    expect(next).toBe(state)
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

  it('supports uneven superset with per-exercise sets and parameters', () => {
    const unevenRoutine = {
      id: 'r-uneven',
      name: 'Uneven Day',
      position: 'Session 1 of 1',
      blocks: [
        {
          id: 'b-uneven',
          type: 'superset',
          exercises: [
            {
              exerciseId: 'bench-press',
              repMin: 6,
              repMax: 8,
              rir: 1,
              targetWeight: 100,
              sequence: [
                { type: 'set' },
                { type: 'rest', seconds: 60 },
                { type: 'set' },
                { type: 'rest', seconds: 60 },
                { type: 'set' },
              ], // 3 sets
            },
            {
              exerciseId: 'barbell-row',
              repMin: 10,
              repMax: 12,
              rir: 2,
              targetWeight: 60,
              sequence: [
                { type: 'set' },
                { type: 'rest', seconds: 45 },
                { type: 'set' },
              ], // 2 sets
            },
          ],
        },
      ],
    }

    const started = reducer(baseState({ routines: [unevenRoutine], routineOrder: [unevenRoutine.id] }), {
      type: 'START_WORKOUT',
      payload: { routineId: unevenRoutine.id },
    })

    const unit = started.activeWorkout.exercises[0]
    expect(unit.blockType).toBe('superset')
    expect(unit.exerciseIds).toEqual(['bench-press', 'barbell-row'])
    // Round 0: Bench, Row. Round 1: Bench, Row. Round 2: Bench. Total = 5 sets.
    expect(unit.sets).toHaveLength(5)
    expect(unit.sets.map((s) => s.exerciseIndex)).toEqual([0, 1, 0, 1, 0])
    expect(unit.sets.map((s) => s.exerciseId)).toEqual([
      'bench-press',
      'barbell-row',
      'bench-press',
      'barbell-row',
      'bench-press',
    ])
    // Targets are individual:
    expect(unit.sets[0].targetWeight).toBe(100)
    expect(unit.sets[1].targetWeight).toBe(60)
    expect(unit.sets[0].targetRir).toBe(1)
    expect(unit.sets[1].targetRir).toBe(2)

    // Rest after:
    // Round 0: set 0 null, set 1 has rest 45s
    // Round 1: set 2 null, set 3 has rest 60s (since bench has a 3rd set, rest before round 2)
    // Round 2: set 4 null (last set of the block)
    expect(unit.restAfter[0]).toBeNull()
    expect(unit.restAfter[1]).toBe(45)
    expect(unit.restAfter[2]).toBeNull()
    expect(unit.restAfter[3]).toBe(60)
    expect(unit.restAfter[4]).toBeNull()
  })
})

describe('REST_ADJUST / REST_SKIP', () => {
  function startedWithSetDone(setIndex) {
    const routine = sampleRoutine()
    const started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
    const aw = started.activeWorkout
    const withValues = {
      ...started,
      activeWorkout: {
        ...aw,
        exercises: [{ ...aw.exercises[0], sets: aw.exercises[0].sets.map((s, i) => (i === setIndex ? { ...s, weight: '60', reps: '10' } : s)) }],
      },
    }
    return reducer(withValues, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 0, setIndex } })
  }

  it('TOGGLE_SET_DONE records which exercise and set index started the rest', () => {
    const next = startedWithSetDone(0)
    expect(next.activeWorkout.restUntil).not.toBeNull()
    expect(next.activeWorkout.restExerciseIndex).toBe(0)
    expect(next.activeWorkout.restSetIndex).toBe(0)
    expect(next.activeWorkout.restTotalSec).toBe(90)
  })

  it('shifts restUntil and keeps restTotalSec in sync with it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0))
    try {
      const resting = startedWithSetDone(0)
      const restUntilBefore = new Date(resting.activeWorkout.restUntil).getTime()

      const extended = reducer(resting, { type: 'REST_ADJUST', payload: 15 })
      expect(new Date(extended.activeWorkout.restUntil).getTime()).toBe(restUntilBefore + 15000)
      expect(extended.activeWorkout.restTotalSec).toBe(105)

      const shortened = reducer(extended, { type: 'REST_ADJUST', payload: -15 })
      expect(new Date(shortened.activeWorkout.restUntil).getTime()).toBe(restUntilBefore)
      expect(shortened.activeWorkout.restTotalSec).toBe(90)
    } finally {
      vi.useRealTimers()
    }
  })

  it('clamps the deadline so repeated "-15s" taps can never push it into the past', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0))
    try {
      const resting = startedWithSetDone(0) // 90s rest
      const clamped = reducer(resting, { type: 'REST_ADJUST', payload: -300 })
      expect(new Date(clamped.activeWorkout.restUntil).getTime()).toBe(Date.now())
      expect(clamped.activeWorkout.restTotalSec).toBeGreaterThanOrEqual(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('REST_SKIP clears every rest field, not just restUntil', () => {
    const resting = startedWithSetDone(0)
    const skipped = reducer(resting, { type: 'REST_SKIP' })
    expect(skipped.activeWorkout.restUntil).toBeNull()
    expect(skipped.activeWorkout.restExerciseIndex).toBeNull()
    expect(skipped.activeWorkout.restSetIndex).toBeNull()
    expect(skipped.activeWorkout.restTotalSec).toBeNull()
  })
})

describe('TOGGLE_SET_DONE does not arm rest on the final set of the workout', () => {
  // Two single-set blocks, each with an explicit trailing rest in its
  // sequence — the routine builder now allows authoring exactly this.
  function twoBlockRoutineWithTrailingRests() {
    return {
      id: 'r1',
      name: 'Push Day',
      position: 'Session 1 of 1',
      blocks: [
        { id: 'block1', type: 'single', exerciseIds: ['bench-press'], repMin: 8, repMax: 12, rir: 2, targetWeight: null, sequence: [{ type: 'set' }, { type: 'rest', seconds: 60 }] },
        { id: 'block2', type: 'single', exerciseIds: ['barbell-row'], repMin: 8, repMax: 12, rir: 2, targetWeight: null, sequence: [{ type: 'set' }, { type: 'rest', seconds: 60 }] },
      ],
    }
  }

  function markSetDone(exerciseIndex) {
    const routine = twoBlockRoutineWithTrailingRests()
    const started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
    const aw = started.activeWorkout
    const exercises = aw.exercises.map((e, i) => (i === exerciseIndex ? { ...e, sets: e.sets.map((s) => ({ ...s, weight: '60', reps: '10' })) } : e))
    const withValues = { ...started, activeWorkout: { ...aw, exercises } }
    return reducer(withValues, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex, setIndex: 0 } })
  }

  it('does not arm the timer on the final set of the final exercise, even with a trailing rest', () => {
    const next = markSetDone(1) // last block's only set
    expect(next.activeWorkout.restUntil).toBeNull()
    expect(next.activeWorkout.restExerciseIndex).toBeNull()
    expect(next.activeWorkout.restSetIndex).toBeNull()
    expect(next.activeWorkout.restTotalSec).toBeNull()
  })

  it('still arms the timer on the final set of a non-final exercise', () => {
    const next = markSetDone(0) // first block's only set — a real exercise transition follows
    expect(next.activeWorkout.restUntil).not.toBeNull()
    expect(next.activeWorkout.restExerciseIndex).toBe(0)
    expect(next.activeWorkout.restSetIndex).toBe(0)
    expect(next.activeWorkout.restTotalSec).toBe(60)
  })
})

describe('TOGGLE_SET_DONE auto-advances currentIndex once the active exercise is fully logged', () => {
  function threeBlockRoutine() {
    return {
      id: 'r1',
      name: 'Push Day',
      position: 'Session 1 of 1',
      blocks: [
        { id: 'block1', type: 'single', exerciseIds: ['bench-press'], repMin: 8, repMax: 12, rir: 2, targetWeight: null, sequence: [{ type: 'set' }] },
        { id: 'block2', type: 'single', exerciseIds: ['barbell-row'], repMin: 8, repMax: 12, rir: 2, targetWeight: null, sequence: [{ type: 'set' }] },
        { id: 'block3', type: 'single', exerciseIds: ['incline-db-press'], repMin: 8, repMax: 12, rir: 2, targetWeight: null, sequence: [{ type: 'set' }] },
      ],
    }
  }

  function started() {
    const routine = threeBlockRoutine()
    return reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })
  }

  function withLoggedValues(state, exerciseIndex) {
    const aw = state.activeWorkout
    const exercises = aw.exercises.map((e, i) => (i === exerciseIndex ? { ...e, sets: e.sets.map((s) => ({ ...s, weight: '60', reps: '10' })) } : e))
    return { ...state, activeWorkout: { ...aw, exercises } }
  }

  it('jumps to the next unfinished exercise once the current one\'s only set is checked off', () => {
    const state = withLoggedValues(started(), 0)
    const next = reducer(state, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 0, setIndex: 0 } })
    expect(next.activeWorkout.currentIndex).toBe(1)
  })

  it('does not move currentIndex when toggling a set on a unit that isn\'t the active one', () => {
    const state = withLoggedValues(started(), 1)
    const next = reducer(state, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 1, setIndex: 0 } })
    expect(next.activeWorkout.currentIndex).toBe(0)
  })

  it('does not move currentIndex when un-checking an already-done set', () => {
    const state = withLoggedValues(started(), 0)
    const done = reducer(state, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 0, setIndex: 0 } })
    expect(done.activeWorkout.currentIndex).toBe(1)

    const undone = reducer(done, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 0, setIndex: 0 } })
    expect(undone.activeWorkout.currentIndex).toBe(1)
  })

  it('stays put when the just-finished exercise is the last one', () => {
    const state = withLoggedValues(started(), 2)
    const withCurrent = { ...state, activeWorkout: { ...state.activeWorkout, currentIndex: 2 } }
    const next = reducer(withCurrent, { type: 'TOGGLE_SET_DONE', payload: { exerciseIndex: 2, setIndex: 0 } })
    expect(next.activeWorkout.currentIndex).toBe(2)
  })
})

describe('SET_NOTIF_FALLBACK', () => {
  it('sets the flag on the active workout when a workout is active', () => {
    const routine = sampleRoutine()
    const started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })

    const flagged = reducer(started, { type: 'SET_NOTIF_FALLBACK', payload: true })
    expect(flagged.activeWorkout.notifFallback).toBe(true)

    const cleared = reducer(flagged, { type: 'SET_NOTIF_FALLBACK', payload: false })
    expect(cleared.activeWorkout.notifFallback).toBe(false)
  })

  it('is a no-op when there is no active workout', () => {
    const state = baseState()
    const next = reducer(state, { type: 'SET_NOTIF_FALLBACK', payload: true })
    expect(next).toBe(state)
  })
})

describe('SET_FINISH_REQUESTED', () => {
  it('sets the flag on the active workout when a workout is active', () => {
    const routine = sampleRoutine()
    const started = reducer(baseState({ routines: [routine], routineOrder: [routine.id] }), { type: 'START_WORKOUT', payload: { routineId: routine.id } })

    const flagged = reducer(started, { type: 'SET_FINISH_REQUESTED', payload: true })
    expect(flagged.activeWorkout.finishRequested).toBe(true)

    const cleared = reducer(flagged, { type: 'SET_FINISH_REQUESTED', payload: false })
    expect(cleared.activeWorkout.finishRequested).toBe(false)
  })

  it('is a no-op when there is no active workout', () => {
    const state = baseState()
    const next = reducer(state, { type: 'SET_FINISH_REQUESTED', payload: true })
    expect(next).toBe(state)
  })
})
