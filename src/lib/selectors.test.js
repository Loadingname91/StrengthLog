import { describe, it, expect } from 'vitest'
import {
  bestProductForExercise, totalVolume, totalReps, totalSets, muscleSetCounts, exerciseSetCounts,
  recentPRs, dayTallies, weekStreak, exerciseProgress, epley1RM,
} from './selectors'
import { localISODate } from './format'

// Builds a YYYY-MM-DD `n` days before today, so streak/window tests stay
// correct whenever they run rather than being pinned to a fixed calendar.
function isoDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localISODate(d)
}

function session(overrides = {}) {
  return {
    id: 's1',
    date: '2026-01-01',
    entries: [],
    ...overrides,
  }
}

describe('totalVolume / totalReps / totalSets', () => {
  const s = session({
    entries: [
      { exerciseId: 'bench-press', sets: [{ weight: 60, reps: 10 }, { weight: 60, reps: 8 }] },
      { exerciseId: 'barbell-row', sets: [{ weight: 50, reps: 10 }] },
    ],
  })

  it('sums weight*reps across all sets and entries', () => {
    expect(totalVolume(s)).toBe(60 * 10 + 60 * 8 + 50 * 10)
  })

  it('sums reps across all sets and entries', () => {
    expect(totalReps(s)).toBe(10 + 8 + 10)
  })

  it('counts total sets across all entries', () => {
    expect(totalSets(s)).toBe(3)
  })
})

describe('bestProductForExercise', () => {
  const sessions = [
    session({ date: '2026-01-01', entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 10 }] }] }),
    session({ date: '2026-01-08', entries: [{ exerciseId: 'bench-press', sets: [{ weight: 70, reps: 9 }] }] }),
  ]

  it('returns the highest weight*reps product across sessions', () => {
    expect(bestProductForExercise(sessions, 'bench-press')).toBe(70 * 9)
  })

  it('ignores sessions after beforeDate', () => {
    expect(bestProductForExercise(sessions, 'bench-press', '2026-01-05')).toBe(60 * 10)
  })

  it('returns 0 when the exercise has no history', () => {
    expect(bestProductForExercise(sessions, 'never-logged')).toBe(0)
  })
})

describe('muscleSetCounts', () => {
  it('counts full sets for the primary muscle and half for the secondary', () => {
    const sessions = [
      session({ entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 10 }, { weight: 60, reps: 8 }] }] }),
    ]
    // bench-press: primary Chest, secondary Triceps
    const counts = muscleSetCounts(sessions)
    expect(counts.Chest).toBe(2)
    expect(counts.Triceps).toBe(1)
  })
})

describe('exerciseSetCounts', () => {
  it('counts sets per exercise across sessions', () => {
    const sessions = [
      session({ entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 10 }] }] }),
      session({ entries: [{ exerciseId: 'bench-press', sets: [{ weight: 62.5, reps: 8 }] }] }),
    ]
    expect(exerciseSetCounts(sessions)['bench-press']).toBe(2)
  })
})

describe('recentPRs', () => {
  it('collects flagged PR sets newest-first and caps at the limit', () => {
    const sessions = [
      session({ id: 'a', date: '2026-01-01', entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8, isPR: true }] }] }),
      session({ id: 'b', date: '2026-01-08', entries: [{ exerciseId: 'back-squat', sets: [{ weight: 100, reps: 5, isPR: true }] }] }),
    ]
    const prs = recentPRs(sessions)
    expect(prs.map((p) => p.exerciseId)).toEqual(['back-squat', 'bench-press'])
    expect(recentPRs(sessions, 1)).toHaveLength(1)
  })

  it('ignores sets that are not flagged as PRs', () => {
    const sessions = [
      session({ entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8, isPR: false }, { weight: 60, reps: 8 }] }] }),
    ]
    expect(recentPRs(sessions)).toEqual([])
  })
})

describe('dayTallies', () => {
  it('groups sessions by date, summing count and volume', () => {
    const sessions = [
      session({ id: 'a', date: '2026-01-01', volume: 1000 }),
      session({ id: 'b', date: '2026-01-01', volume: 500 }),
      session({ id: 'c', date: '2026-01-02', volume: 700 }),
    ]
    expect(dayTallies(sessions)['2026-01-01']).toEqual({ count: 2, volume: 1500 })
    expect(dayTallies(sessions)['2026-01-02']).toEqual({ count: 1, volume: 700 })
  })
})

describe('weekStreak', () => {
  it('returns 0 with no sessions', () => {
    expect(weekStreak([])).toBe(0)
  })

  it('counts the current week when it has a session', () => {
    expect(weekStreak([session({ date: isoDaysAgo(0) })])).toBeGreaterThanOrEqual(1)
  })

  it('keeps a streak alive when the current week has nothing logged yet', () => {
    // 8 days back is always in a previous week regardless of which weekday
    // the test runs on.
    expect(weekStreak([session({ date: isoDaysAgo(8) })])).toBe(1)
  })

  it('stops counting at a fully skipped week', () => {
    const sessions = [session({ date: isoDaysAgo(0) }), session({ date: isoDaysAgo(21) })]
    expect(weekStreak(sessions)).toBe(1)
  })
})

describe('exerciseProgress', () => {
  const sessions = [
    session({ date: '2026-01-01', entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8 }] }] }),
    session({ date: '2026-01-15', entries: [{ exerciseId: 'bench-press', sets: [{ weight: 65, reps: 8 }] }] }),
  ]

  it('reports the latest top set and its delta against the session before', () => {
    const p = exerciseProgress(sessions, 'bench-press')
    expect(p.latest).toMatchObject({ weight: 65, reps: 8 })
    expect(p.weightDelta).toBe(5)
    expect(p.repsDelta).toBe(0)
    expect(p.sessionCount).toBe(2)
    expect(p.weeks).toBe(2)
  })

  it('reports the est. 1RM change across the whole history', () => {
    const p = exerciseProgress(sessions, 'bench-press')
    expect(p.e1rm).toBe(epley1RM(65, 8))
    expect(p.e1rmTotalDelta).toBe(Math.round((epley1RM(65, 8) - epley1RM(60, 8)) * 10) / 10)
  })

  it('picks the top set by estimated 1RM, not by weight*reps', () => {
    // 53.75x10 wins on raw product (537.5 vs 510) but 63.75x8 is the
    // stronger set and the one a lifter reads as their top set.
    const s = [session({
      date: '2026-02-01',
      entries: [{ exerciseId: 'bench-press', sets: [{ weight: 53.75, reps: 10 }, { weight: 63.75, reps: 8 }] }],
    })]
    expect(exerciseProgress(s, 'bench-press').latest).toMatchObject({ weight: 63.75, reps: 8 })
  })

  it('leaves deltas null on a first-ever session and returns null with no history', () => {
    const p = exerciseProgress([sessions[0]], 'bench-press')
    expect(p.weightDelta).toBeNull()
    expect(p.e1rmTotalDelta).toBeNull()
    expect(exerciseProgress(sessions, 'never-logged')).toBeNull()
  })
})
