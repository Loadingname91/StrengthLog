import { exerciseById } from './exercises'
import { startOfWeek, startOfMonth, daysAgo } from './format'

export function allSets(session) {
  return session.entries.flatMap((e) => e.sets.map((s) => ({ ...s, exerciseId: e.exerciseId })))
}

export function sessionsSince(sessions, sinceDate) {
  const since = sinceDate.toISOString().slice(0, 10)
  return sessions.filter((s) => s.date >= since)
}

export function sessionsInRange(sessions, fromDate, toDate) {
  const from = fromDate.toISOString().slice(0, 10)
  const to = toDate.toISOString().slice(0, 10)
  return sessions.filter((s) => s.date >= from && s.date <= to)
}

export function muscleSetCounts(sessions) {
  const counts = {}
  for (const session of sessions) {
    for (const entry of session.entries) {
      const ex = exerciseById(entry.exerciseId)
      if (!ex) continue
      counts[ex.primary] = (counts[ex.primary] || 0) + entry.sets.length
      if (ex.secondary) counts[ex.secondary] = (counts[ex.secondary] || 0) + entry.sets.length * 0.5
    }
  }
  return counts
}

export function exerciseSetCounts(sessions) {
  const counts = {}
  for (const session of sessions) {
    for (const entry of session.entries) {
      counts[entry.exerciseId] = (counts[entry.exerciseId] || 0) + entry.sets.length
    }
  }
  return counts
}

export function goalProgress(goal, sessions) {
  if (goal.type === 'muscleSets') {
    const since = goal.period === 'week' ? startOfWeek() : startOfMonth()
    const current = Math.round(muscleSetCounts(sessionsSince(sessions, since))[goal.muscle] || 0)
    return {
      label: `${goal.target} sets for ${goal.muscle.toLowerCase()} this ${goal.period}`,
      current,
      target: goal.target,
      pct: Math.min(100, Math.round((current / goal.target) * 100)),
    }
  }
  if (goal.type === 'workoutCount') {
    const since = goal.period === 'week' ? startOfWeek() : startOfMonth()
    const current = sessionsSince(sessions, since).length
    return {
      label: `${goal.target} workouts this ${goal.period}`,
      current,
      target: goal.target,
      pct: Math.min(100, Math.round((current / goal.target) * 100)),
    }
  }
  return { label: goal.label || 'Goal', current: 0, target: goal.target || 1, pct: 0 }
}

// Daily bucket series for the Home overview chart / Stats frequency chart.
export function chartSeries(sessions, metric, days, exerciseId) {
  const from = daysAgo(days - 1)
  const inRange = sessionsInRange(sessions, from, new Date())
  const out = []
  for (let i = 0; i < days; i++) {
    const d = daysAgo(days - 1 - i)
    const iso = d.toISOString().slice(0, 10)
    const daySessions = inRange.filter((s) => s.date === iso)
    let value = 0
    if (metric === 'workouts') value = daySessions.length
    else if (metric === 'volume') value = daySessions.reduce((sum, s) => sum + s.volume, 0)
    else if (metric === 'exercise' && exerciseId) {
      value = Math.max(0, ...daySessions.flatMap((s) => topSetFor(s, exerciseId)))
    }
    out.push({ date: iso, value })
  }
  return out
}

function topSetFor(session, exerciseId) {
  const entry = session.entries.find((e) => e.exerciseId === exerciseId)
  if (!entry) return [0]
  return entry.sets.map((s) => s.weight)
}

export function toPolyline(series, width, height, pad = 4) {
  const values = series.map((p) => p.value)
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const spanX = width - pad * 2
  const spanY = height - pad * 2
  return series
    .map((p, i) => {
      const x = pad + (series.length <= 1 ? 0 : (i / (series.length - 1)) * spanX)
      const t = max === min ? 0.5 : (p.value - min) / (max - min)
      const y = pad + (1 - t) * spanY
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function exerciseHistory(sessions, exerciseId) {
  return sessions
    .filter((s) => s.entries.some((e) => e.exerciseId === exerciseId))
    .map((s) => {
      const entry = s.entries.find((e) => e.exerciseId === exerciseId)
      return { date: s.date, sessionId: s.id, sets: entry.sets }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function bestProductForExercise(sessions, exerciseId, beforeDate) {
  let best = 0
  for (const session of sessions) {
    if (beforeDate && session.date > beforeDate) continue
    const entry = session.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    for (const s of entry.sets) best = Math.max(best, s.weight * s.reps)
  }
  return best
}

const REP_BUCKETS = [5, 8, 12]
export function prByRepRange(sessions, exerciseId) {
  const table = Object.fromEntries(REP_BUCKETS.map((b) => [b, 0]))
  for (const { sets } of exerciseHistory(sessions, exerciseId)) {
    for (const s of sets) {
      const bucket = REP_BUCKETS.reduce((a, b) => (Math.abs(b - s.reps) < Math.abs(a - s.reps) ? b : a))
      table[bucket] = Math.max(table[bucket], s.weight)
    }
  }
  return REP_BUCKETS.map((reps) => ({ reps, weight: table[reps] }))
}

export function lastSessionSets(sessions, exerciseId, beforeDate) {
  const hist = exerciseHistory(sessions, exerciseId).filter((h) => !beforeDate || h.date < beforeDate)
  if (!hist.length) return null
  return hist[hist.length - 1].sets
}

export function topSetSparklinePoints(sessions, exerciseId, n = 7) {
  const hist = exerciseHistory(sessions, exerciseId).slice(-n)
  return hist.map((h) => ({ date: h.date, value: Math.max(0, ...h.sets.map((s) => s.weight)) }))
}

export function totalVolume(session) {
  return session.entries.reduce((sum, e) => sum + e.sets.reduce((a, s) => a + s.weight * s.reps, 0), 0)
}

export function totalReps(session) {
  return session.entries.reduce((sum, e) => sum + e.sets.reduce((a, s) => a + s.reps, 0), 0)
}

export function totalSets(session) {
  return session.entries.reduce((sum, e) => sum + e.sets.length, 0)
}
