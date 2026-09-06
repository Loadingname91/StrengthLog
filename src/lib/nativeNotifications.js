import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { REMINDER_ID } from './reminderPlan'

function isNative() {
  return Capacitor.isNativePlatform()
}

// Phase 8's custom foreground service — local/custom, registered natively
// via MainActivity.registerPlugin, not an npm package.
const WorkoutNotification = registerPlugin('WorkoutNotification')

// Fixed ids so a reschedule always replaces the same notification instead of
// accumulating duplicates. There's ever at most one rest countdown active,
// hence a singleton id; REMINDER_ID (imported by reminderPlan's own tests)
// is the reminder's equivalent.
const REST_DONE_ID = 8001
const PR_ID = 7001

// @capacitor/local-notifications defaults every schedule() call to
// isExactNotification: true, which on API 31+ opens the system "Alarms &
// reminders" settings screen the first time it's needed — a jarring, easy
// to trigger accidentally surprise for what's meant to be a lightweight
// rest-timer ping. Explicitly false everywhere: precision for the rest
// alert is Phase 8's foreground-service timer's job (a wake lock, not an
// alarm), and a reminder firing within a ten-minute window is fine.
const INEXACT = { isExactNotification: false }

// True once WorkoutNotification.start() has actually been called and
// succeeded — guards updateWorkout()/stopWorkout() from calling into a
// service that was never started (permission denied, or the user turned
// off Settings' "Ongoing workout notification"). Without this,
// Context.startService() would silently bring the foreground service up
// as a side effect of an unrelated content update — exactly what a denied
// permission must never do.
let serviceActive = false

export async function ensureChannels() {
  if (!isNative()) return
  await LocalNotifications.createChannel({ id: 'fitlog_rest_v1', name: 'Rest timer', importance: 4, visibility: 1, vibration: true })
  await LocalNotifications.createChannel({ id: 'fitlog_reminders_v1', name: 'Workout reminders', importance: 3, visibility: 1 })
  await LocalNotifications.createChannel({ id: 'fitlog_pr_v1', name: 'Personal records', importance: 3, visibility: 1 })
}

export async function checkNotificationPermission() {
  if (!isNative()) return 'unsupported'
  const { display } = await LocalNotifications.checkPermissions()
  return display
}

export async function requestNotificationPermission() {
  if (!isNative()) return 'unsupported'
  const { display } = await LocalNotifications.requestPermissions()
  return display
}

// Starts the real foreground service (Phase 8) unless the user turned the
// ongoing notification off entirely, or notification permission is denied —
// in which case it returns true so the caller can show a fallback banner
// (the in-app beep already fires regardless, unconditionally, elsewhere).
// Requesting permission here (rather than a separate call) means the
// decision and the request happen together, atomically, before anything
// else can act on a stale result.
export async function startWorkout(payload) {
  if (!isNative()) return false
  serviceActive = false
  if (!payload.notifyOngoing) return false
  const display = await requestNotificationPermission()
  if (display !== 'granted') return true
  await WorkoutNotification.start({ workoutId: payload.workoutId, startedAt: payload.startedAt })
  serviceActive = true
  return false
}

export function updateWorkout(payload) {
  if (!isNative() || !serviceActive) return
  WorkoutNotification.update({
    workoutId: payload.workoutId,
    exerciseName: payload.exerciseName,
    setsDone: payload.setsDone,
    setsTotal: payload.setsTotal,
    // Crosses the bridge as epoch millis, not the ISO string the reducer
    // stores restUntil as — keeps date parsing entirely on this side, so
    // the native service never needs anything beyond a plain Long.
    restUntilMs: payload.restUntil ? new Date(payload.restUntil).getTime() : 0,
    restTotalSec: payload.restTotalSec || 0,
    notifyRestDone: payload.notifyRestDone,
  })
}

export function stopWorkout() {
  if (!isNative()) return
  // Unconditional and first: cleans up a stray Phase-7-era scheduled
  // notification if one were somehow still pending from before this phase.
  LocalNotifications.cancel({ notifications: [{ id: REST_DONE_ID }] })
  if (!serviceActive) return
  serviceActive = false
  WorkoutNotification.stop()
}

// Pending-action drain: applies (and acks) every Skip/+15s tap the service
// queued while this WebView may not have been alive to receive it live.
// `apply` is the caller's own guarded dispatch (see useWorkoutNotifications.js
// effect E) — this function only owns draining and acking, not the
// workoutId-match/dispatch decision.
export async function drainPendingActions(apply) {
  if (!isNative()) return
  const { actions } = await WorkoutNotification.getPending()
  for (const a of actions) {
    apply(a)
    await WorkoutNotification.ack({ id: a.id })
  }
}

// The fast path: live while this WebView is already running. Returns the
// listener-handle promise as-is so the caller can remove() it on cleanup.
export function onWorkoutAction(handler) {
  if (!isNative()) return Promise.resolve({ remove: () => {} })
  return WorkoutNotification.addListener('workoutAction', handler)
}

export function ackAction(id) {
  if (!isNative()) return
  WorkoutNotification.ack({ id })
}

// Posted only when the app isn't in the foreground — ActiveWorkout already
// shows an in-app PR badge, so a shade notification for something the user
// is already looking at would just be noise.
export function notifyPR(payload) {
  if (!isNative() || !payload.notifyPR || document.visibilityState === 'visible') return
  LocalNotifications.schedule({
    notifications: [{
      id: PR_ID,
      title: 'New PR! 🏆',
      body: payload.exerciseName ? `${payload.exerciseName} — nice work!` : 'Nice work.',
      channelId: 'fitlog_pr_v1',
      autoCancel: true,
      ...INEXACT,
    }],
  })
}

export function scheduleReminders(plan) {
  if (!isNative()) return
  // buildReminderPlan only ever produces one entry, always at REMINDER_ID —
  // cancelling that fixed id before rescheduling is what keeps a reschedule
  // from ever leaking an orphaned notification.
  LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
  if (!plan.length) return
  LocalNotifications.schedule({
    notifications: plan.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      schedule: { at: r.at, ...INEXACT },
      channelId: 'fitlog_reminders_v1',
      autoCancel: true,
    })),
  })
}
