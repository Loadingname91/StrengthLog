import { exerciseById } from './exercises'
import { startOfWeek, startOfMonth, daysAgo, localISODate, round1 } from './format'

// Parses a stored YYYY-MM-DD as *local* midnight. `new Date('2026-01-05')`
// alone parses as UTC midnight, which lands on the previous day for anyone
// behind UTC — the same trap localISODate exists to avoid.
function parseLocalDate(iso) {
  return new Date(`${iso}T00:00:00`)
}

export function epley1RM(weight, reps) {
  return round1(weight * (1 + reps / 30))
}

export function allSets(session) {
  return session.entries.flatMap((e) => e.sets.map((s) => ({ ...s, exerciseId: e.exerciseId })))
}

export function sessionsSince(sessions, sinceDate) {
  const since = localISODate(sinceDate)
  return sessions.filter((s) => s.date >= since)
}

export function sessionsInRange(sessions, fromDate, toDate) {
  const from = localISODate(fromDate)
  const to = localISODate(toDate)
  return sessions.filter((s) => s.date >= from && s.date <= to)
}

export function muscleSetCounts(sessions, exercises) {
  const counts = {}
  for (const session of sessions) {
    for (const entry of session.entries) {
      const ex = exerciseById(entry.exerciseId, exercises)
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

export function goalProgress(goal, sessions, exercises) {
  if (goal.type === 'muscleSets') {
    const since = goal.period === 'week' ? startOfWeek() : startOfMonth()
    const current = Math.round(muscleSetCounts(sessionsSince(sessions, since), exercises)[goal.muscle] || 0)
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
    const iso = localISODate(d)
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

// PR events newest-first. The isPR flag is stamped on each set at log time,
// so this reads them back rather than recomputing bests.
export function recentPRs(sessions, limit = 5) {
  const prs = []
  for (const session of sessions) {
    for (const entry of session.entries) {
      for (const set of entry.sets) {
        if (set.isPR) {
          prs.push({ exerciseId: entry.exerciseId, weight: set.weight, reps: set.reps, date: session.date, sessionId: session.id })
        }
      }
    }
  }
  return prs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

// Per-day tallies for the consistency calendar: date -> { count, volume }.
export function dayTallies(sessions) {
  const out = {}
  for (const session of sessions) {
    const cur = out[session.date] || { count: 0, volume: 0 }
    cur.count += 1
    cur.volume += session.volume || 0
    out[session.date] = cur
  }
  return out
}

// Consecutive weeks ending with the current one that contain at least one
// session. Weeks rather than days on purpose: rest days are part of a correct
// program, so a day-streak would punish following one.
export function weekStreak(sessions, today = new Date()) {
  if (!sessions.length) return 0
  const weeks = new Set(sessions.map((s) => localISODate(startOfWeek(parseLocalDate(s.date)))))
  const cursor = startOfWeek(today)
  // A current week with nothing logged yet doesn't break a streak that ran
  // through last week — it just hasn't been extended.
  if (!weeks.has(localISODate(cursor))) cursor.setDate(cursor.getDate() - 7)
  let streak = 0
  while (weeks.has(localISODate(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

// The current `days`-long window against the average of the `lookback`
// windows before it — the "up 8% on your 4-week average" comparison. Returns
// null percentages when there's no prior history to compare against.
export function trailingComparison(sessions, days = 7, lookback = 4) {
  const current = sessionsInRange(sessions, daysAgo(days - 1), new Date())
  const prior = sessionsInRange(sessions, daysAgo(days * (lookback + 1) - 1), daysAgo(days))
  const stats = (list) => ({
    workouts: list.length,
    sets: list.reduce((sum, s) => sum + totalSets(s), 0),
    volume: Math.round(list.reduce((sum, s) => sum + (s.volume || 0), 0)),
  })
  const cur = stats(current)
  const base = stats(prior)
  const pct = (value, baseTotal) => {
    const baseline = baseTotal / lookback
    if (!baseline) return null
    return Math.round(((value - baseline) / baseline) * 100)
  }
  return {
    ...cur,
    hasBaseline: prior.length > 0,
    workoutsPct: pct(cur.workouts, base.workouts),
    setsPct: pct(cur.sets, base.sets),
    volumePct: pct(cur.volume, base.volume),
  }
}

// Latest top set vs the session before it, plus the change across all logged
// history. At the handful-of-sessions scale this app operates at, these
// numbers carry the progression a line chart can only hint at.
export function exerciseProgress(sessions, exerciseId) {
  const hist = exerciseHistory(sessions, exerciseId)
  if (!hist.length) return null
  // Ranked by estimated 1RM, not weight*reps: a light high-rep set can win on
  // raw product (53.75x10 beats 63.75x8) and would headline a session with
  // the lifter's *lightest* set, understating the strength they showed.
  const topOf = (sets) => sets.reduce((best, s) => (epley1RM(s.weight, s.reps) > epley1RM(best.weight, best.reps) ? s : best), sets[0])
  const latest = topOf(hist[hist.length - 1].sets)
  const prev = hist.length > 1 ? topOf(hist[hist.length - 2].sets) : null
  const first = topOf(hist[0].sets)
  const spanMs = parseLocalDate(hist[hist.length - 1].date) - parseLocalDate(hist[0].date)
  return {
    latest,
    prev,
    sessionCount: hist.length,
    weeks: Math.max(1, Math.round(spanMs / (7 * 86400000))),
    e1rm: epley1RM(latest.weight, latest.reps),
    weightDelta: prev ? round1(latest.weight - prev.weight) : null,
    repsDelta: prev ? latest.reps - prev.reps : null,
    e1rmTotalDelta: hist.length > 1 ? round1(epley1RM(latest.weight, latest.reps) - epley1RM(first.weight, first.reps)) : null,
  }
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
