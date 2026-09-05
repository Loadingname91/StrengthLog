import { Capacitor } from '@capacitor/core'

function isNative() {
  return Capacitor.isNativePlatform()
}

// Every export here is a deliberate no-op. The native plugin backing the
// ongoing workout notification (a custom Capacitor plugin) and the one
// backing reminders/PR alerts (@capacitor/local-notifications) don't exist
// in this checkout yet — useWorkoutNotifications.js is built and tested
// against this exact call surface first, so wiring in the real native calls
// later is a change to this file alone, not to the effect layer that calls it.
export function startWorkout(_payload) {
  if (!isNative()) return
}

export function updateWorkout(_payload) {
  if (!isNative()) return
}

export function stopWorkout() {
  if (!isNative()) return
}

export function notifyPR(_payload) {
  if (!isNative()) return
}

export function scheduleReminders(_plan) {
  if (!isNative()) return
}

export function drainPendingActions() {
  return Promise.resolve([])
}

export function ackActions(_ids) {
  if (!isNative()) return
}
