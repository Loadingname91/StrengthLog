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

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
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

