import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { ALL_REMINDER_IDS } from './reminderPlan'

function isNative() {
  return Capacitor.isNativePlatform()
}

// Phase 8's custom foreground service — local/custom, registered natively
// via MainActivity.registerPlugin, not an npm package.
const WorkoutNotification = registerPlugin('WorkoutNotification')

// Fixed ids so a reschedule always replaces the same notification instead of
// accumulating duplicates. There's ever at most one rest countdown active,
// hence a singleton id; reminders (see reminderPlan.js) get a whole range
// of ids instead, one per weekday plus a one-shot slot, since several can
// be active at once.
const REST_DONE_ID = 8001
const PR_ID = 7001

// @capacitor/local-notifications defaults every schedule() call to
// isExactNotification: true, which on API 31+ opens the system "Alarms &
// reminders" settings screen the first time it's needed — a jarring
// surprise for what's meant to be a lightweight PR ping, which nobody
// needs delivered to the minute. Note this belongs on the NOTIFICATION,
// not inside `schedule`: it used to be spread into the reminder's schedule
// object, where the plugin ignores it, so reminders silently requested
// exact alarms (and that settings screen) for every user. Reminders now
// opt into exactness deliberately — see scheduleReminders below.
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
  // fitlog_rest_v1 is deliberately untouched — postRestDoneAlert() always
  // posts with setSilent(true) (WorkoutService.kt), so this channel's own
  // sound is never actually used; the rest-done ding plays via its own
  // MediaPlayer instead (see playDuckedDing()'s bundled fitlog_chime asset).
  await LocalNotifications.createChannel({ id: 'fitlog_rest_v1', name: 'Rest timer', importance: 4, visibility: 1, vibration: true })
  // _v2: channels are immutable after first creation, so a device that
  // already made _v1 silently (no sound/vibration field was ever passed)
  // can never be fixed in place — only a new channel id takes the new
  // config. fitlog_chime is a bundled asset (res/raw/), not the system
  // default sound, so this doesn't depend on the phone's own default
  // notification sound being audible.
  await LocalNotifications.createChannel({ id: 'fitlog_reminders_v2', name: 'Workout reminders', importance: 3, visibility: 1, sound: 'fitlog_chime', vibration: true })
  await LocalNotifications.createChannel({ id: 'fitlog_pr_v2', name: 'Personal records', importance: 3, visibility: 1, sound: 'fitlog_chime', vibration: true })
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

// The "Alarms & reminders" special access (SCHEDULE_EXACT_ALARM), separate
// from the notification permission above: without it a reminder still posts,
// just batched by the OS instead of landing on the minute.
export async function checkExactAlarmPermission() {
  if (!isNative()) return 'unsupported'
  const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting()
  return exact_alarm
}

export async function openExactAlarmSettings() {
  if (!isNative()) return 'unsupported'
  const { exact_alarm } = await LocalNotifications.changeExactNotificationSetting()
  return exact_alarm
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
      channelId: 'fitlog_pr_v2',
      autoCancel: true,
      ...INEXACT,
    }],
  })
}

// Serialized: this runs both from the reminders effect and from a `resume`
// listener, and every run blanket-cancels the whole id range before
// scheduling — two overlapping runs would let B's cancel wipe A's freshly
// scheduled notifications. Callers stay fire-and-forget.
let reminderQueue = Promise.resolve()

export function scheduleReminders(plan) {
  if (!isNative()) return
  reminderQueue = reminderQueue.then(() => applyReminderPlan(plan)).catch(() => {})
  return reminderQueue
}

async function applyReminderPlan(plan) {
  // Cancel the entire range reminders own rather than tracking what was
  // scheduled last time: it needs no bookkeeping, can't leak an orphan when
  // a reminder is deleted or its days change, and getPending() is no help
  // here (it also lists already-fired records).
  await LocalNotifications.cancel({ notifications: ALL_REMINDER_IDS.map((id) => ({ id })) })
  if (!plan.length) return
  // Checked, not assumed: scheduling an exact notification without the
  // permission makes the plugin open the system settings screen mid-call.
  // Denied just means the OS batches delivery, which is a fine fallback.
  const isExactNotification = (await checkExactAlarmPermission()) === 'granted'
  await LocalNotifications.schedule({
    notifications: plan.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      channelId: 'fitlog_reminders_v2',
      autoCancel: true,
      isExactNotification,
      // `on` is a true weekly recurrence the plugin re-arms itself, so a
      // standing reminder survives the app being killed, and a reboot.
      // Caveat: only the first fire gets setExactAndAllowWhileIdle — the
      // plugin's own re-arm drops to plain setExact, so later occurrences
      // can be Doze-deferred until the next resume reschedules them.
      //
      // The +1 is the plugin's Calendar convention (Sunday = 1); the app is
      // 0-based Sunday everywhere else. This is the only place they meet.
      schedule: r.on
        ? { on: { weekday: r.on.weekday + 1, hour: r.on.hour, minute: r.on.minute }, allowWhileIdle: true }
        : { at: r.at, allowWhileIdle: true },
    })),
  })
}
