import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { REMINDER_ID } from './reminderPlan'

function isNative() {
  return Capacitor.isNativePlatform()
}

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
// alert is Phase 2's foreground-service timer's job (a wake lock, not an
// alarm), and a reminder firing within a ten-minute window is fine.
const INEXACT = { isExactNotification: false }

let lastRestUntil = null

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

export function startWorkout(_payload) {
  if (!isNative()) return
  // Phase 2: the real ongoing notification, backed by a foreground service.
}

// Provisional rest-done alert until Phase 2 replaces it with an in-process
// timer under a wake lock, immune to Doze. A scheduled OS notification can
// drift under battery optimization — accepted for now, and strictly better
// than today's alert, which is silent unless the /workout screen is open.
export function updateWorkout(payload) {
  if (!isNative()) return
  if (payload.restUntil === lastRestUntil) return
  lastRestUntil = payload.restUntil
  LocalNotifications.cancel({ notifications: [{ id: REST_DONE_ID }] })
  if (payload.restUntil && payload.notifyRestDone) {
    LocalNotifications.schedule({
      notifications: [{
        id: REST_DONE_ID,
        title: 'Rest done',
        body: payload.exerciseName ? `Back to ${payload.exerciseName}` : 'Time for your next set',
        schedule: { at: new Date(payload.restUntil), ...INEXACT },
        channelId: 'fitlog_rest_v1',
        autoCancel: true,
      }],
    })
  }
}

export function stopWorkout() {
  if (!isNative()) return
  lastRestUntil = null
  LocalNotifications.cancel({ notifications: [{ id: REST_DONE_ID }] })
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
