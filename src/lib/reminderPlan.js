import { dueInfo, weekdayName } from './schedule'
import { localISODate } from './format'

export const REMINDER_ID = 9001

// There's only ever one reminder to plan: whichever routine is "next up" in
// the rotation (routineOrder[sequenceIndex]) is the exact routine Home.jsx
// already surfaces as its "Next up" card — this tracks that, rather than
// giving every routine its own independent weekly alarm regardless of the
// rotation's current position.
export function buildReminderPlan(state, now = new Date()) {
  if (!state.settings?.notifyReminders) return []
  const nextRoutineId = state.routineOrder[state.sequenceIndex] || state.routineOrder[0]
  const nextRoutine = state.routines.find((r) => r.id === nextRoutineId)
  if (!nextRoutine) return []

  const today = localISODate(now)
  const due = dueInfo(nextRoutine.id, state.weekdayAssignments, state.sessions, state.scheduleRestartAt, state.createdAt, today)
  // Overdue and due-today both mean "remind today"; a future weekday due
  // date (weekday mode only) gets a reminder on that future date instead.
  const fireDateISO = due.isToday || due.isOverdue ? today : due.dueDate

  const [hh, mm] = (state.settings.reminderTime || '18:00').split(':').map(Number)
  const [y, m, d] = fireDateISO.split('-').map(Number)
  const at = new Date(y, m - 1, d, hh, mm, 0, 0)
  // Today's reminder time has already passed. Rather than fire immediately
  // on every app open for the rest of the day, skip it — the plan is
  // recomputed on the next relevant state change or app open, so tomorrow's
  // (or the next due date's) reminder still lands on schedule.
  if (at <= now) return []

  const title = due.isOverdue ? `${nextRoutine.name} is overdue` : `Time for ${nextRoutine.name}`
  const body = due.weekday != null ? `Assigned for ${weekdayName(due.weekday)}` : 'Tap to start your next workout'
  return [{ id: REMINDER_ID, at, title, body }]
}
