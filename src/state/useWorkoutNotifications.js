import { useEffect, useRef } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { exerciseById, unitName } from '../lib/exercises'
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
export function useWorkoutNotifications(state, dispatch, exercises) {
  const aw = state.activeWorkout
  const awId = aw?.id ?? null

  // Read fresh inside effect A/E's stable closures without adding `state`
  // to their dependency arrays (which would re-run them on every change
  // instead of only on the transitions each actually cares about). Synced
  // in its own effect, not during render — a ref write belongs after
  // commit, not in the render body.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })
  const restUntil = aw?.restUntil ?? null
  const restTotal = aw?.restTotalSec ?? null
  const currentUnit = aw ? aw.exercises[aw.currentIndex] : null
  const setsDone = countDone(currentUnit)
  const setsTotal = countTotal(currentUnit)
  const exerciseName = currentUnit ? unitName(currentUnit, exercises) : null
  const lastPRExerciseIndex = aw?.lastPR?.exerciseIndex ?? null
  const lastPRSetIndex = aw?.lastPR?.setIndex ?? null
  const prKey = aw?.lastPR ? `${awId}:${lastPRExerciseIndex}:${lastPRSetIndex}` : null

  const lastPRUnit = aw && lastPRExerciseIndex != null ? aw.exercises[lastPRExerciseIndex] : null
  const lastPRSet = lastPRUnit && lastPRSetIndex != null ? lastPRUnit.sets[lastPRSetIndex] : null
  const lastPRExId = lastPRUnit
    ? (lastPRUnit.blockType === 'superset' ? lastPRUnit.exerciseIds[lastPRSet?.exerciseIndex] : lastPRUnit.exerciseId)
    : null
  const lastPRName = lastPRExId ? exerciseById(lastPRExId, exercises)?.name ?? null : null

  const { notifyRestDone, notifyPR: notifyPREnabled, notifyReminders, reminderTime } = state.settings

  // Seeded from the current value, not null: lastPR is never cleared for the
  // life of a workout (it just carries forward on every TOGGLE_SET_DONE), so
  // without this a cold reload mid-workout would re-celebrate whatever PR
  // was already sitting in persisted state.
  const firedPrKeyRef = useRef(prKey)

  // Created once per app run; createChannel is idempotent (a no-op if the
  // channel already exists), so this is safe to call on every native launch.
  useEffect(() => {
    native.ensureChannels()
  }, [])

  // A — lifecycle. FINISH_WORKOUT, DISCARD_WORKOUT and DELETE_ALL_DATA all
  // set activeWorkout to null wholesale, so that one transition is the only
  // "cancel everything" seam this needs. A non-null id on mount (a workout
  // persisted across a cold app restart) starts it too. Requesting the
  // permission here (rather than a specific "Start Workout" button) covers
  // every entry point that begins a workout — Home's card and
  // WorkoutOverview's — with one line instead of two.
  // startedAt/notifyOngoing are read via stateRef, not the closure, so
  // they're exempt from dependency tracking (same reasoning as effect E
  // below) — deliberately: starting/stopping is tied to a workout
  // beginning or ending, not a reactive response to the setting changing
  // mid-workout (the same deliberate [awId]-only scope this effect already
  // had for permission requests).
  useEffect(() => {
    if (awId) {
      const current = stateRef.current
      native.startWorkout({
        workoutId: awId,
        startedAt: current.activeWorkout.startedAt,
        notifyOngoing: current.settings.notifyOngoing,
      }).then((fallback) => {
        dispatch({ type: 'SET_NOTIF_FALLBACK', payload: fallback })
      })
    } else {
      native.stopWorkout()
    }
  }, [awId, dispatch])

  // B — content.
  useEffect(() => {
    if (!awId) return
    native.updateWorkout({ workoutId: awId, restUntil, restTotalSec: restTotal, setsDone, setsTotal, exerciseName, notifyRestDone })
  }, [awId, restUntil, restTotal, setsDone, setsTotal, exerciseName, notifyRestDone])

  // C — PR celebration. Keyed on workout id + set coordinates together: keying
  // on coordinates alone would either miss a genuinely new PR that happens to
  // land at the same {exerciseIndex,setIndex} in a later workout, or replay
  // an old one — see the ref's seeding above.
  useEffect(() => {
    if (!prKey || firedPrKeyRef.current === prKey) return
    firedPrKeyRef.current = prKey
    native.notifyPR({ workoutId: awId, exerciseIndex: lastPRExerciseIndex, setIndex: lastPRSetIndex, exerciseName: lastPRName, notifyPR: notifyPREnabled })
  }, [prKey, awId, lastPRExerciseIndex, lastPRSetIndex, lastPRName, notifyPREnabled])

  // D — reminders. None of these fields change during an active workout
  // (SET_SET_FIELD/TOGGLE_SET_DONE/REST_* only ever touch activeWorkout), so
  // this stays quiet while a workout is being logged and only recomputes on
  // an actual schedule-relevant change: a session finishing, a schedule
  // edit, or the reminder setting itself changing.
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

  // E — pending native action drain. A Skip/+15s/Finish tap applied to the
  // notification while the app was backgrounded or killed reaches the
  // reducer through here: WorkoutService (Phase 8) applies Skip/+15s to its
  // own state immediately and queues every action durably; this drains that
  // queue on mount (covering a killed-and-restarted process), again on
  // Capacitor's `resume` event (Phase 9 — covers the app merely being
  // backgrounded with a frozen, not fully killed, WebView, which a
  // mount-only drain would miss), and listens for the same event live (the
  // fast path, while the WebView is already alive). All three funnel
  // through one guarded apply(): REST_SKIP/REST_ADJUST reuse the exact
  // actions the in-app Skip/+15s controls already dispatch; FINISH_TAPPED
  // sets a flag ActiveWorkout.jsx's own finish() logic interprets, since
  // whether a confirmation is needed is that screen's decision, not this
  // effect layer's.
  useEffect(() => {
    function apply(a) {
      if (a.workoutId !== stateRef.current.activeWorkout?.id) return
      if (a.type === 'REST_SKIP') dispatch({ type: 'REST_SKIP' })
      else if (a.type === 'REST_ADJUST') dispatch({ type: 'REST_ADJUST', payload: a.payload })
      else if (a.type === 'FINISH_TAPPED') dispatch({ type: 'SET_FINISH_REQUESTED', payload: true })
    }
    native.drainPendingActions(apply)
    const resumeSubPromise = CapacitorApp.addListener('resume', () => native.drainPendingActions(apply))
    const actionSubPromise = native.onWorkoutAction((a) => {
      apply(a)
      native.ackAction(a.id)
    })
    return () => {
      resumeSubPromise.then((sub) => sub.remove())
      actionSubPromise.then((sub) => sub.remove())
    }
  }, [dispatch])
}
