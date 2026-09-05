export function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function fmtDateLong(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function fmtElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

// Local calendar-day string (YYYY-MM-DD). Deliberately NOT `toISOString()`,
// which converts to UTC and silently shifts the date near midnight in any
// timezone behind UTC (a workout logged at 11pm local would land on
// "tomorrow" everywhere — goals, stats, weekday schedule, CSV export).
export function localISODate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO() {
  return localISODate()
}

export function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export function startOfWeek(d = new Date()) {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7 // Monday = 0
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

export function startOfMonth(d = new Date()) {
  const date = new Date(d)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

export function round1(n) {
  return Math.round(n * 10) / 10
}

export function blockTarget(block) {
  return `${block.sets}×${block.repMin}-${block.repMax}`
}

