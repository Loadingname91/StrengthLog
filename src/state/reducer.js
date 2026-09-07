import { EXERCISES } from '../lib/exercises'
import { blockTarget, todayISO, localISODate } from '../lib/format'
import { bestProductForExercise, totalVolume } from '../lib/selectors'
import { backfillSequence } from '../lib/blocks'
import { uid } from '../lib/id'
import { nextFreeSeq } from '../lib/reminderPlan'

export function initialSettings() {
  return {
    units: 'kg',
    theme: 'system',
    restDefault: 90,
    showRIR: true,
    notifyRestDone: true,
    notifyOngoing: true,
    notifyPR: true,
  }
}

// Expands one routine block into a runtime unit. A superset block produces
// ONE merged unit (not one per exercise) whose flat `sets` array interleaves
// every exercise's sets in round order, each tagged with `exerciseIndex` —
// this is what lets a single confirm-to-advance focus chain (see
// ActiveWorkout.jsx's SetRow) cross from one exercise's set straight into
// the paired exercise's, with no separate navigation state needed.
// `restAfter` is a parallel array: restAfter[i] holds the rest duration to
// start once sets[i] is completed, generalizing what pairIndex/pairSize used
// to special-case for supersets only into one mechanism for every block.
function expandUnit(block) {
  const b = backfillSequence(block)
  const isSuperset = b.type === 'superset'
  const n = isSuperset ? b.exerciseIds.length : 1
  const sets = []
  const restAfter = []
  for (const step of b.sequence) {
    if (step.type === 'rest') {
      if (sets.length > 0) restAfter[sets.length - 1] = step.seconds
      continue
    }
    for (let k = 0; k < n; k++) {
      sets.push({ weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: k })
      restAfter.push(null)
    }
  }
  return {
    blockId: b.id,
    blockType: b.type,
    exerciseIds: b.exerciseIds,
    exerciseId: isSuperset ? undefined : b.exerciseIds[0],
    target: blockTarget(b),
    rir: b.rir,
    targetWeight: b.targetWeight ?? null,
    sets,
    restAfter,
  }
}

function buildActiveWorkoutFromRoutine(routine) {
  return {
    id: uid('workout'),
    routineId: routine.id,
    routineName: routine.name,
    startedAt: new Date().toISOString(),
    currentIndex: 0,
    restUntil: null,
    restExerciseIndex: null,
    restSetIndex: null,
    restTotalSec: null,
    exercises: routine.blocks.map(expandUnit),
  }
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

    case 'ADD_REMINDER': {
      // seq indexes the reminder's reserved block of notification ids, so it
      // has to be unique among live reminders — never patched afterwards.
      const seq = nextFreeSeq(state.reminders)
      if (seq == null) return state
      const reminder = { id: uid('rem'), seq, enabled: true, mode: 'auto', time: '18:00', days: [], label: '', ...action.payload }
      return { ...state, reminders: [...state.reminders, reminder] }
    }

    case 'UPDATE_REMINDER': {
      const reminders = state.reminders.map((r) => (r.id === action.payload.id ? { ...r, ...action.payload.patch } : r))
      return { ...state, reminders }
    }

    case 'DELETE_REMINDER':
      return { ...state, reminders: state.reminders.filter((r) => r.id !== action.payload) }

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
      // Never silently discard an in-progress session — callers must
      // dispatch DISCARD_WORKOUT (after explicit user confirmation) before
      // starting a new one. Defense-in-depth backstop; UI call sites already
      // resume the existing session instead of reaching this case at all.
      if (state.activeWorkout) return state
      const routine = state.routines.find((r) => r.id === action.payload.routineId)
      if (!routine) return state
      return { ...state, activeWorkout: buildActiveWorkoutFromRoutine(routine) }
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
      const exercises = state.activeWorkout.exercises.map((ex, i) => {
        if (i !== action.payload.exerciseIndex) return ex
        // A superset round always adds/removes one set per exercise in the
        // pair together, keeping the exerciseIndex alternation (and the
        // round-grouping this feeds in ActiveWorkout's UI) intact.
        const n = ex.blockType === 'superset' ? ex.exerciseIds.length : 1
        const newSets = Array.from({ length: n }, (_, k) => ({ weight: '', reps: '', rir: null, done: false, isPR: false, exerciseIndex: k }))
        return { ...ex, sets: [...ex.sets, ...newSets], restAfter: [...ex.restAfter, ...Array(n).fill(null)] }
      })
      return { ...state, activeWorkout: { ...state.activeWorkout, exercises } }
    }

    case 'REMOVE_SET': {
      if (!state.activeWorkout) return state
      const exercises = state.activeWorkout.exercises.map((ex, i) => {
        if (i !== action.payload.exerciseIndex) return ex
        const n = ex.blockType === 'superset' ? ex.exerciseIds.length : 1
        if (ex.sets.length <= n) return ex
        return { ...ex, sets: ex.sets.slice(0, -n), restAfter: ex.restAfter.slice(0, -n) }
      })
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
          const exerciseId = ex.blockType === 'superset' ? ex.exerciseIds[set.exerciseIndex] : ex.exerciseId
          const priorBest = bestProductForExercise(state.sessions, exerciseId)
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
      let restSetIndex = aw.restSetIndex
      let restTotalSec = aw.restTotalSec
      const restSeconds = ex.restAfter[setIndex]
      if (willBeDone && restSeconds != null) {
        restUntil = new Date(Date.now() + restSeconds * 1000).toISOString()
        restExerciseIndex = exerciseIndex
        restSetIndex = setIndex
        restTotalSec = restSeconds
      }

      return { ...state, activeWorkout: { ...aw, exercises, restUntil, restExerciseIndex, restSetIndex, restTotalSec, lastPR: isPR ? { exerciseIndex, setIndex } : aw.lastPR } }
    }

    case 'GOTO_EXERCISE':
      if (!state.activeWorkout) return state
      return { ...state, activeWorkout: { ...state.activeWorkout, currentIndex: action.payload } }

    case 'REST_ADJUST': {
      if (!state.activeWorkout?.restUntil) return state
      const now = Date.now()
      const prevUntilMs = new Date(state.activeWorkout.restUntil).getTime()
      // Clamped so repeated "-15s" taps near the end of a rest can't push the
      // deadline into the past — a native alarm armed against a past
      // timestamp would fire immediately instead of not at all.
      const nextUntilMs = Math.max(now, prevUntilMs + action.payload * 1000)
      // restTotalSec is the ring's denominator; it has to move with the
      // deadline; or "+15s" would visually overflow the ring past full.
      const prevTotal = state.activeWorkout.restTotalSec ?? 0
      const nextTotal = Math.max(1, prevTotal + action.payload)
      return {
        ...state,
        activeWorkout: { ...state.activeWorkout, restUntil: new Date(nextUntilMs).toISOString(), restTotalSec: nextTotal },
      }
    }

    case 'REST_SKIP':
      if (!state.activeWorkout) return state
      return { ...state, activeWorkout: { ...state.activeWorkout, restUntil: null, restExerciseIndex: null, restSetIndex: null, restTotalSec: null } }

    // Workout-scoped, like lastPR — cleared implicitly when activeWorkout
    // resets to null. Set by useWorkoutNotifications.js's effect A once
    // startWorkout() resolves, so ActiveWorkout can show a banner when
    // notification permission is denied (NOTIF-13).
    case 'SET_NOTIF_FALLBACK':
      if (!state.activeWorkout) return state
      return { ...state, activeWorkout: { ...state.activeWorkout, notifFallback: action.payload } }

    // Set when the notification's "Finish" action is tapped (Phase 9,
    // NOTIF-15); ActiveWorkout.jsx is the sole reader/clearer — it runs its
    // own existing finish() logic rather than this effect finishing the
    // workout directly.
    case 'SET_FINISH_REQUESTED':
      if (!state.activeWorkout) return state
      return { ...state, activeWorkout: { ...state.activeWorkout, finishRequested: action.payload } }

    case 'FINISH_WORKOUT': {
      const aw = state.activeWorkout
      if (!aw) return state
      const entries = aw.exercises
        .flatMap((ex) => {
          // A single-exercise unit's sets all carry exerciseIndex 0 — this
          // uniformly produces one entry for it, and one entry per exercise
          // for a merged superset unit, without a separate code path.
          const exerciseIds = ex.blockType === 'superset' ? ex.exerciseIds : [ex.exerciseId]
          return exerciseIds.map((exerciseId, idx) => ({
            exerciseId,
            blockId: ex.blockId,
            sets: ex.sets
              .filter((s) => s.exerciseIndex === idx && s.done && s.weight !== '' && s.reps !== '')
              .map((s) => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps, 10) || 0, rir: s.rir, isPR: !!s.isPR })),
          }))
        })
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
        lastFinishedSession: null,
      }

    default:
      return state
  }
}

export function allExercises(state) {
  return [...EXERCISES, ...state.customExercises]
}
