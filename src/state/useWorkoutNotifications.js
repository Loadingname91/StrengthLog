import { useEffect, useRef } from 'react'
import { unitName } from '../lib/exercises'
import { buildReminderPlan } from '../lib/reminderPlan'
import * as native from '../lib/nativeNotifications'

function countDone(unit) {
  return unit ? unit.sets.filter((s) => s.done).length : 0
}

function countTotal(unit) {
  return unit ? unit.sets.length : 0
}

// A side effect layered on top of the reducer, the same architectural slot
// as persistence (StoreContext's own saveState effect) — mounted once for
// the life of the app so it runs on every route, not just /workout.
//
// The whole design turns on one fact: SET_SET_FIELD (every weight/reps
// keystroke) replaces `activeWorkout` with a brand-new object every time,
// but touches none of the primitives below. Depending on those primitives
// instead of on `activeWorkout` itself means typing into a field never
// re-runs these effects or reaches the native bridge — only an actual
// lifecycle/rest/PR change does.
export function useWorkoutNotifications(state, exercises) {
  const aw = state.activeWorkout
  const awId = aw?.id ?? null
  const restUntil = aw?.restUntil ?? null
  const restTotal = aw?.restTotalSec ?? null
  const currentUnit = aw ? aw.exercises[aw.currentIndex] : null
  const setsDone = countDone(currentUnit)
  const setsTotal = countTotal(currentUnit)
  const exerciseName = currentUnit ? unitName(currentUnit, exercises) : null
  const lastPRExerciseIndex = aw?.lastPR?.exerciseIndex ?? null
  const lastPRSetIndex = aw?.lastPR?.setIndex ?? null
  const prKey = aw?.lastPR ? `${awId}:${lastPRExerciseIndex}:${lastPRSetIndex}` : null

  // Seeded from the current value, not null: lastPR is never cleared for the
  // life of a workout (it just carries forward on every TOGGLE_SET_DONE), so
  // without this a cold reload mid-workout would re-celebrate whatever PR
  // was already sitting in persisted state.
  const firedPrKeyRef = useRef(prKey)

  // A — lifecycle. FINISH_WORKOUT, DISCARD_WORKOUT and DELETE_ALL_DATA all
  // set activeWorkout to null wholesale, so that one transition is the only
  // "cancel everything" seam this needs. A non-null id on mount (a workout
  // persisted across a cold app restart) starts it too.
  useEffect(() => {
    if (awId) native.startWorkout({ workoutId: awId })
    else native.stopWorkout()
  }, [awId])

  // B — content.
  useEffect(() => {
    if (!awId) return
    native.updateWorkout({ workoutId: awId, restUntil, restTotalSec: restTotal, setsDone, setsTotal, exerciseName })
  }, [awId, restUntil, restTotal, setsDone, setsTotal, exerciseName])

  // C — PR celebration. Keyed on workout id + set coordinates together: keying
  // on coordinates alone would either miss a genuinely new PR that happens to
  // land at the same {exerciseIndex,setIndex} in a later workout, or replay
  // an old one — see the ref's seeding above.
  useEffect(() => {
    if (!prKey || firedPrKeyRef.current === prKey) return
    firedPrKeyRef.current = prKey
    native.notifyPR({ workoutId: awId, exerciseIndex: lastPRExerciseIndex, setIndex: lastPRSetIndex })
  }, [prKey, awId, lastPRExerciseIndex, lastPRSetIndex])

  // D — reminders. None of these fields change during an active workout
  // (SET_SET_FIELD/TOGGLE_SET_DONE/REST_* only ever touch activeWorkout), so
  // this stays quiet while a workout is being logged and only recomputes on
  // an actual schedule-relevant change: a session finishing, a schedule
  // edit, or the reminder setting itself changing.
  const { notifyReminders, reminderTime } = state.settings
  const { routineOrder, sequenceIndex, routines, weekdayAssignments, sessions, scheduleRestartAt, createdAt } = state
  useEffect(() => {
    const plan = buildReminderPlan({
      settings: { notifyReminders, reminderTime },
      routineOrder,
      sequenceIndex,
      routines,
      weekdayAssignments,
      sessions,
      scheduleRestartAt,
      createdAt,
    })
    native.scheduleReminders(plan)
  }, [notifyReminders, reminderTime, routineOrder, sequenceIndex, routines, weekdayAssignments, sessions, scheduleRestartAt, createdAt])
}
