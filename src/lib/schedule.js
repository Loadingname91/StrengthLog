// Weekday-mode scheduling. The rotation pointer (routineOrder/sequenceIndex)
// is the same one Sequence mode uses — it only ever advances when a workout
// is finished. Weekday mode adds a *due date* on top of that pointer: each
// routine has a preferred weekday, and the due date is the next occurrence
// of that weekday on or after "nextUpSince" (the day after the last
// finished session, or a manual restart anchor). If that date has already
// passed, the routine is simply "due now" — nothing skips ahead further
// until it's actually completed, so a missed day pushes the whole rotation
// forward by exactly the gap, one day at a time, without any separate
// drift counter to keep in sync.
import { localISODate } from './format'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weekdayName(day, short = false) {
  return (short ? WEEKDAY_SHORT : WEEKDAY_NAMES)[day]
}

// Spreads routines across Mon-Sun in rotation order, one routine per day,
// leaving trailing days as rest if there are fewer than 7 routines.
export function defaultWeekdayAssignments(routineOrder) {
  const map = {}
  routineOrder.forEach((id, i) => {
    if (i < 7) map[id] = ((i + 1) % 7) // 0=Mon offset -> weekday 1..6,0
  })
  return map
}

// All date arithmetic here works with "YYYY-MM-DD" local calendar-day
// strings, parsed and reformatted via local Date components only — never
// `toISOString()`, which converts to UTC and can shift the result by a day
// depending on the local timezone offset and time of day.
function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return localISODate(d)
}

function weekdayOf(iso) {
  return parseISO(iso).getDay()
}

// First date >= sinceISO whose weekday matches targetWeekday.
function nextOccurrence(sinceISO, targetWeekday) {
  const startWeekday = weekdayOf(sinceISO)
  const delta = (targetWeekday - startWeekday + 7) % 7
  return addDays(sinceISO, delta)
}

// The date on/after which the current next-up routine's due date is
// calculated: the day after the last finished session, or the restart
// anchor if one was set and is more recent.
export function nextUpSince(sessions, scheduleRestartAt, createdAt) {
  const lastDate = sessions.length ? [...sessions].sort((a, b) => a.date.localeCompare(b.date)).at(-1).date : createdAt
  const afterLast = addDays(lastDate, 1)
  if (scheduleRestartAt && scheduleRestartAt > afterLast) return scheduleRestartAt
  return afterLast
}

export function dueInfo(routineId, weekdayAssignments, sessions, scheduleRestartAt, createdAt, today = todayISODate()) {
  const targetWeekday = weekdayAssignments[routineId]
  const since = nextUpSince(sessions, scheduleRestartAt, createdAt)
  if (targetWeekday == null) {
    return { dueDate: since, isToday: since <= today, isOverdue: since < today, weekday: null }
  }
  const dueDate = nextOccurrence(since, targetWeekday)
  return {
    dueDate,
    isToday: dueDate === today,
    isOverdue: dueDate < today,
    weekday: targetWeekday,
  }
}

function todayISODate() {
  return localISODate()
}

// 7 consecutive dates (Mon-Sun) for the week `weekOffset` weeks from the
// current week (0 = this week, -1 = last week, 1 = next week).
export function weekStripDates(weekOffset = 0) {
  const today = todayISODate()
  const day = (weekdayOf(today) + 6) % 7 // Monday = 0
  const monday = addDays(today, -day + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

// What a given calendar date's cell should show: the template routine for
// that weekday, and whether it was completed, missed, is today, or is in
// the future.
export function dayStatus(dateISO, weekdayAssignments, sessions, today = todayISODate()) {
  const weekday = weekdayOf(dateISO)
  const routineId = Object.keys(weekdayAssignments).find((id) => weekdayAssignments[id] === weekday) || null
  // Any completed workout counts for the day — training a different
  // routine than the template expects isn't a "miss," just flexibility.
  const doneHere = sessions.some((s) => s.date === dateISO)
  let state
  if (dateISO > today) state = 'future'
  else if (doneHere) state = 'done'
  else if (!routineId) state = 'rest'
  else if (dateISO === today) state = 'today'
  else state = 'missed'
  return { routineId, state }
}
