import { EXERCISES } from '../lib/exercises'
import { blockTarget, todayISO, localISODate } from '../lib/format'
import { bestProductForExercise, totalVolume } from '../lib/selectors'
import { uid } from '../lib/id'

export function initialSettings() {
  return { units: 'kg', theme: 'system', restDefault: 90, showRIR: true }
}

function buildActiveWorkoutFromRoutine(routine, sessions) {
  const exercises = []
  routine.blocks.forEach((block) => {
    block.exerciseIds.forEach((exerciseId, pairIndex) => {
      exercises.push({
        exerciseId,
        blockId: block.id,
        blockType: block.type,
        pairIndex,
        pairSize: block.exerciseIds.length,
        target: blockTarget(block),
        rest: block.rest,
        rir: block.rir,
        sets: Array.from({ length: block.sets }, () => ({ weight: '', reps: '', rir: null, done: false, isPR: false })),
      })
    })
  })
  return {
    id: uid('workout'),
    routineId: routine.id,
    routineName: routine.name,
    startedAt: new Date().toISOString(),
    currentIndex: 0,
    restUntil: null,
    restExerciseIndex: null,
    exercises,
  }
}

function isLastInPair(aw, index) {
  const ex = aw.exercises[index]
  if (ex.blockType !== 'superset') return true
  return ex.pairIndex === ex.pairSize - 1
}

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } }

    case 'SET_ROUTINE_MODE':
      return { ...state, routineMode: action.payload }

    case 'ADD_CUSTOM_EXERCISE': {
      const ex = { ...action.payload, id: action.payload.id || uid('ex'), custom: true }
      return { ...state, customExercises: [...state.customExercises, ex] }
    }

    case 'UPDATE_EXERCISE_NOTES':
      return { ...state, exerciseNotes: { ...state.exerciseNotes, [action.payload.exerciseId]: action.payload.notes } }

    case 'ADD_ROUTINE': {
      const routine = { ...action.payload, id: action.payload.id || uid('routine') }
      const routines = [...state.routines, routine]
      const taken = new Set(Object.values(state.weekdayAssignments))
      const freeWeekday = [1, 2, 3, 4, 5, 6, 0].find((d) => !taken.has(d))
      const weekdayAssignments = freeWeekday == null ? state.weekdayAssignments : { ...state.weekdayAssignments, [routine.id]: freeWeekday }
      return { ...state, routines, routineOrder: [...state.routineOrder, routine.id], weekdayAssignments }
    }

    case 'UPDATE_ROUTINE': {
      const routines = state.routines.map((r) => (r.id === action.payload.id ? { ...r, ...action.payload.patch } : r))
      return { ...state, routines }
    }

    case 'DELETE_ROUTINE': {
      const routines = state.routines.filter((r) => r.id !== action.payload)
      const routineOrder = state.routineOrder.filter((id) => id !== action.payload)
      const weekdayAssignments = { ...state.weekdayAssignments }
      delete weekdayAssignments[action.payload]
      return { ...state, routines, routineOrder, weekdayAssignments }
    }

    case 'REORDER_ROUTINES':
      return { ...state, routineOrder: action.payload }

    case 'SET_WEEKDAY_ASSIGNMENT': {
      const weekdayAssignments = { ...state.weekdayAssignments }
      if (action.payload.weekday == null) delete weekdayAssignments[action.payload.routineId]
      else weekdayAssignments[action.payload.routineId] = action.payload.weekday
      return { ...state, weekdayAssignments }
    }

    case 'RESTART_SCHEDULE':
      return { ...state, scheduleRestartAt: todayISO() }

    case 'ADD_GOAL':
      return { ...state, goals: [...state.goals, { ...action.payload, id: uid('goal') }] }
    case 'UPDATE_GOAL':
      return { ...state, goals: state.goals.map((g) => (g.id === action.payload.id ? { ...g, ...action.payload.patch } : g)) }
    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter((g) => g.id !== action.payload) }

    case 'ADD_MEASUREMENT':
      return { ...state, measurements: [...state.measurements, { ...action.payload, id: uid('measure') }].sort((a, b) => a.date.localeCompare(b.date)) }
    case 'UPDATE_MEASUREMENT':
      return { ...state, measurements: state.measurements.map((m) => (m.id === action.payload.id ? { ...m, ...action.payload.patch } : m)) }
    case 'DELETE_MEASUREMENT':
      return { ...state, measurements: state.measurements.filter((m) => m.id !== action.payload) }

    case 'START_WORKOUT': {
      const routine = state.routines.find((r) => r.id === action.payload.routineId)
      if (!routine) return state
      return { ...state, activeWorkout: buildActiveWorkoutFromRoutine(routine, state.sessions) }
    }

    case 'DISCARD_WORKOUT':
      return { ...state, activeWorkout: null }

    case 'SET_SET_FIELD': {
      if (!state.activeWorkout) return state
      const { exerciseIndex, setIndex, field, value } = action.payload
      const exercises = state.activeWorkout.exercises.map((ex, i) => {
        if (i !== exerciseIndex) return ex
        const sets = ex.sets.map((s, j) => (j === setIndex ? { ...s, [field]: value } : s))
        return { ...ex, sets }
      })
      return { ...state, activeWorkout: { ...state.activeWorkout, exercises } }
    }

    case 'ADD_SET': {
      if (!state.activeWorkout) return state
      const exercises = state.activeWorkout.exercises.map((ex, i) =>
        i === action.payload.exerciseIndex
          ? { ...ex, sets: [...ex.sets, { weight: '', reps: '', rir: null, done: false, isPR: false }] }
          : ex
      )
      return { ...state, activeWorkout: { ...state.activeWorkout, exercises } }
    }

    case 'REMOVE_SET': {
      if (!state.activeWorkout) return state
      const exercises = state.activeWorkout.exercises.map((ex, i) =>
        i === action.payload.exerciseIndex && ex.sets.length > 1 ? { ...ex, sets: ex.sets.slice(0, -1) } : ex
      )
      return { ...state, activeWorkout: { ...state.activeWorkout, exercises } }
    }

    case 'TOGGLE_SET_DONE': {
      if (!state.activeWorkout) return state
      const aw = state.activeWorkout
      const { exerciseIndex, setIndex } = action.payload
      const ex = aw.exercises[exerciseIndex]
      const set = ex.sets[setIndex]
      const willBeDone = !set.done

      let isPR = false
      if (willBeDone) {
        const weight = parseFloat(set.weight)
        const reps = parseInt(set.reps, 10)
        if (Number.isFinite(weight) && Number.isFinite(reps) && weight > 0 && reps > 0) {
          const priorBest = bestProductForExercise(state.sessions, ex.exerciseId)
          isPR = weight * reps > priorBest
        }
      }

      const exercises = aw.exercises.map((e, i) => {
        if (i !== exerciseIndex) return e
        const sets = e.sets.map((s, j) => (j === setIndex ? { ...s, done: willBeDone, isPR: willBeDone ? isPR : false } : s))
        return { ...e, sets }
      })

      let restUntil = aw.restUntil
      let restExerciseIndex = aw.restExerciseIndex
      if (willBeDone && isLastInPair(aw, exerciseIndex)) {
        restUntil = new Date(Date.now() + ex.rest * 1000).toISOString()
        restExerciseIndex = exerciseIndex
      }

      return { ...state, activeWorkout: { ...aw, exercises, restUntil, restExerciseIndex, lastPR: isPR ? { exerciseIndex, setIndex } : aw.lastPR } }
    }

    case 'GOTO_EXERCISE':
      if (!state.activeWorkout) return state
      return { ...state, activeWorkout: { ...state.activeWorkout, currentIndex: action.payload } }

    case 'REST_ADJUST': {
      if (!state.activeWorkout?.restUntil) return state
      const next = new Date(new Date(state.activeWorkout.restUntil).getTime() + action.payload * 1000)
      return { ...state, activeWorkout: { ...state.activeWorkout, restUntil: next.toISOString() } }
    }

    case 'REST_SKIP':
      if (!state.activeWorkout) return state
      return { ...state, activeWorkout: { ...state.activeWorkout, restUntil: null, restExerciseIndex: null } }

    case 'FINISH_WORKOUT': {
      const aw = state.activeWorkout
      if (!aw) return state
      const entries = aw.exercises
        .map((ex) => ({
          exerciseId: ex.exerciseId,
          blockId: ex.blockId,
          sets: ex.sets
            .filter((s) => s.done && s.weight !== '' && s.reps !== '')
            .map((s) => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps, 10) || 0, rir: s.rir, isPR: !!s.isPR })),
        }))
        .filter((e) => e.sets.length)

      const finishedAt = new Date().toISOString()
      const durationSec = Math.max(1, Math.round((new Date(finishedAt) - new Date(aw.startedAt)) / 1000))
      const session = {
        id: aw.id,
        routineId: aw.routineId,
        routineName: aw.routineName,
        date: localISODate(new Date(aw.startedAt)),
        startedAt: aw.startedAt,
        finishedAt,
        durationSec,
        note: action.payload?.note || '',
        entries,
        volume: 0,
        prCount: entries.reduce((sum, e) => sum + e.sets.filter((s) => s.isPR).length, 0),
      }
      session.volume = Math.round(totalVolume(session))

      const idx = state.routineOrder.indexOf(aw.routineId)
      const sequenceIndex = idx >= 0 ? (idx + 1) % state.routineOrder.length : state.sequenceIndex

      return {
        ...state,
        sessions: [...state.sessions, session],
        activeWorkout: null,
        sequenceIndex,
        lastFinishedSession: session,
      }
    }

    case 'UPDATE_SESSION_NOTE': {
      const sessions = state.sessions.map((s) => (s.id === action.payload.id ? { ...s, note: action.payload.note } : s))
      const lastFinishedSession = state.lastFinishedSession?.id === action.payload.id
        ? { ...state.lastFinishedSession, note: action.payload.note }
        : state.lastFinishedSession
      return { ...state, sessions, lastFinishedSession }
    }

    case 'IMPORT_SESSIONS':
      return { ...state, sessions: [...state.sessions, ...action.payload], lastImportedAt: new Date().toISOString() }

    case 'SAVE_IMPORT_PRESET':
      return { ...state, importPresets: [...state.importPresets, action.payload] }

    case 'DELETE_ALL_DATA':
      return {
        ...state,
        sessions: [],
        measurements: [],
        activeWorkout: null,
        goals: [],
        customExercises: [],
        exerciseNotes: {},
      }

    default:
      return state
  }
}

export function allExercises(state) {
  return [...EXERCISES, ...state.customExercises]
}
