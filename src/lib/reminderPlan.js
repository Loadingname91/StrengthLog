import { dueInfo, weekdayName } from './schedule'
import { localISODate } from './format'

// Reminders own the notification id range 9000..9127: every reminder gets a
// block of 8 consecutive ids keyed by its `seq` — one per weekday, plus a
// trailing slot for the sequence-mode one-shot. Fixed and exhaustive so a
// reschedule can blanket-cancel the whole range without tracking what it
// scheduled last time. (The previous single-id cancel is why a multi-entry
// plan would have leaked orphaned notifications.)
export const REMINDER_ID_BASE = 9000
export const REMINDER_SLOTS = 8
export const ONESHOT_SLOT = 7
export const MAX_REMINDERS = 16
export const ALL_REMINDER_IDS = Array.from(
  { length: MAX_REMINDERS * REMINDER_SLOTS },
  (_, i) => REMINDER_ID_BASE + i,
)

export function reminderNotificationId(seq, slot) {
  return REMINDER_ID_BASE + seq * REMINDER_SLOTS + slot
}

// Smallest seq not already taken. Reusing a freed seq is safe because every
// reschedule cancels the entire owned range first.
export function nextFreeSeq(reminders) {
  const taken = new Set(reminders.map((r) => r.seq))
  for (let seq = 0; seq < MAX_REMINDERS; seq++) {
    if (!taken.has(seq)) return seq
  }
  return null
}

function parseTime(time) {
  const [hour, minute] = (time || '18:00').split(':').map(Number)
  return { hour, minute }
}

// Weekdays stay in the app's own 0=Sunday convention here — the +1 shift to
// the notification plugin's 1=Sunday convention happens once, at the native
// boundary in nativeNotifications.js, and nowhere else.
function customEntries(reminder) {
  const { hour, minute } = parseTime(reminder.time)
  return (reminder.days || []).map((weekday) => ({
    id: reminderNotificationId(reminder.seq, weekday),
    title: reminder.label || 'Workout reminder',
    body: 'Tap to start your workout',
    on: { weekday, hour, minute },
  }))
}

function autoWeekdayEntries(reminder, state) {
  const { hour, minute } = parseTime(reminder.time)
  const entries = []
  for (const [routineId, weekday] of Object.entries(state.weekdayAssignments || {})) {
    const routine = state.routines.find((r) => r.id === routineId)
    if (!routine) continue
    entries.push({
      id: reminderNotificationId(reminder.seq, weekday),
      title: `Time for ${routine.name}`,
      // A standing weekly recurrence is armed by the OS weeks ahead, so it
      // can't know whether the workout is overdue by the time it fires —
      // static wording is the price of not needing the app to be running.
      body: `Assigned for ${weekdayName(weekday)}`,
      on: { weekday, hour, minute },
    })
  }
  return entries
}

// Sequence mode has no fixed weekdays at all: the rotation only advances when
// a workout is finished, so there's no repeating calendar pattern a native
// recurrence could express. This stays a one-shot for whichever routine is
// next up, recomputed on every schedule-relevant change and on app resume.
function autoSequenceEntries(reminder, state, now) {
  const nextRoutineId = state.routineOrder[state.sequenceIndex] || state.routineOrder[0]
  const nextRoutine = state.routines.find((r) => r.id === nextRoutineId)
  if (!nextRoutine) return []

  const today = localISODate(now)
  const due = dueInfo(nextRoutine.id, state.weekdayAssignments, state.sessions, state.scheduleRestartAt, state.createdAt, today)
  // Overdue and due-today both mean "remind today"; a future weekday due
  // date gets a reminder on that future date instead.
  const fireDateISO = due.isToday || due.isOverdue ? today : due.dueDate

  const { hour, minute } = parseTime(reminder.time)
  const [y, m, d] = fireDateISO.split('-').map(Number)
  const at = new Date(y, m - 1, d, hour, minute, 0, 0)
  // Today's reminder time has already passed. Rather than fire immediately on
  // every app open for the rest of the day, skip it — the plan is recomputed
  // on the next relevant state change, so the next one still lands on time.
  if (at <= now) return []

  const title = due.isOverdue ? `${nextRoutine.name} is overdue` : `Time for ${nextRoutine.name}`
  const body = due.weekday != null ? `Assigned for ${weekdayName(due.weekday)}` : 'Tap to start your next workout'
  return [{ id: reminderNotificationId(reminder.seq, ONESHOT_SLOT), at, title, body }]
}

// Expands the reminder list into notification entries. Two shapes come out:
// `{ id, title, body, on: { weekday, hour, minute } }` for a standing weekly
// recurrence, and `{ id, title, body, at }` for a one-shot.
export function buildReminderPlan(state, now = new Date()) {
  const entries = []
  for (const reminder of state.reminders || []) {
    if (!reminder.enabled) continue
    if (reminder.mode === 'custom') entries.push(...customEntries(reminder))
    else if (state.routineMode === 'weekday') entries.push(...autoWeekdayEntries(reminder, state))
    else entries.push(...autoSequenceEntries(reminder, state, now))
  }
  return entries
}
