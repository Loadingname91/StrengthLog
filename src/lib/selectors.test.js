import { describe, it, expect } from 'vitest'
import {
  bestProductForExercise, estimateDuration, recomputePRFlags, totalVolume, totalReps, totalSets, muscleSetCounts, exerciseSetCounts,
  recentPRs, recentSessions, dayTallies, weekStreak, exerciseProgress, epley1RM,
  rirBucketCounts, avgRirByMuscle, weeklySeries, acuteChronicLoad,
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

describe('estimateDuration', () => {
  function routine(overrides = {}) {
    return {
      id: 'r1',
      blocks: [{ type: 'single', exerciseIds: ['bench-press'], sets: 2, repMin: 8, repMax: 12, rest: 60, rir: 2, targetWeight: null }],
      ...overrides,
    }
  }

  it('falls back to the 50s/set + rest formula when there is no history for this routine', () => {
    // [set, rest(60), set] -> 50 + 60 + 50 = 160s -> round(160/60) = 3 min
    expect(estimateDuration(routine(), [])).toBe(3)
  })

  it('uses the average of past finished sessions for this routine once there is history', () => {
    const sessions = [
      session({ id: 's1', date: '2026-01-01', routineId: 'r1', durationSec: 300 }),
      session({ id: 's2', date: '2026-01-08', routineId: 'r1', durationSec: 300 }),
    ]
    expect(estimateDuration(routine(), sessions)).toBe(5)
  })

  it('ignores CSV-imported sessions (durationSec: 0) when averaging', () => {
    const sessions = [
      session({ id: 's1', date: '2026-01-01', routineId: 'r1', durationSec: 300 }),
      session({ id: 's2', date: '2026-01-08', routineId: 'r1', durationSec: 0 }),
    ]
    expect(estimateDuration(routine(), sessions)).toBe(5)
  })

  it('ignores sessions of a different routine', () => {
    const sessions = [
      session({ id: 's1', date: '2026-01-01', routineId: 'r1', durationSec: 300 }),
      session({ id: 's2', date: '2026-01-08', routineId: 'other-routine', durationSec: 3000 }),
    ]
    expect(estimateDuration(routine(), sessions)).toBe(5)
  })
})

describe('recomputePRFlags', () => {
  it('promotes a later set to PR once the earlier session that beat it is removed', () => {
    const sessions = [
      session({
        id: 's1',
        date: '2026-01-01',
        prCount: 0,
        entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 10, isPR: false }] }],
      }),
    ]

    const [recomputed] = recomputePRFlags(sessions)
    expect(recomputed.entries[0].sets[0].isPR).toBe(true)
    expect(recomputed.prCount).toBe(1)
  })

  it('does not mark a set PR when an earlier session already beat it', () => {
    const sessions = [
      session({ id: 's1', date: '2026-01-01', entries: [{ exerciseId: 'bench-press', sets: [{ weight: 100, reps: 10 }] }] }),
      session({ id: 's2', date: '2026-01-02', entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 10 }] }] }),
    ]

    const [, s2] = recomputePRFlags(sessions)
    expect(s2.entries[0].sets[0].isPR).toBe(false)
    expect(s2.prCount).toBe(0)
  })

  it('preserves the original array order regardless of session date order', () => {
    const sessions = [
      session({ id: 's2', date: '2026-01-02', entries: [] }),
      session({ id: 's1', date: '2026-01-01', entries: [] }),
    ]

    const result = recomputePRFlags(sessions)
    expect(result.map((s) => s.id)).toEqual(['s2', 's1'])
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

describe('recentSessions', () => {
  it('returns the newest n sessions in date-descending order', () => {
    const sessions = [
      session({ id: 'a', date: '2026-01-01' }),
      session({ id: 'c', date: '2026-01-15' }),
      session({ id: 'b', date: '2026-01-08' }),
    ]
    expect(recentSessions(sessions, 2).map((s) => s.id)).toEqual(['c', 'b'])
  })

  it('defaults to the single most recent session', () => {
    const sessions = [session({ id: 'a', date: '2026-01-01' }), session({ id: 'b', date: '2026-01-08' })]
    expect(recentSessions(sessions).map((s) => s.id)).toEqual(['b'])
  })

  it('returns an empty array for an empty session list', () => {
    expect(recentSessions([])).toEqual([])
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
    // Use a fixed Monday so the week boundary is deterministic.
    const monday = new Date(2026, 0, 12) // Mon Jan 12 2026
    expect(weekStreak([session({ date: '2026-01-12' })], monday)).toBeGreaterThanOrEqual(1)
  })

  it('keeps a streak alive when the current week has nothing logged yet', () => {
    // today = Mon Jan 19 (no session this week); session on Jan 12 (the prior
    // week) → cursor steps back one week and finds it → streak 1.
    const today = new Date(2026, 0, 19) // Mon Jan 19 2026
    expect(weekStreak([session({ date: '2026-01-12' })], today)).toBe(1)
  })

  it('stops counting at a fully skipped week', () => {
    const monday = new Date(2026, 0, 19) // Mon Jan 19 2026
    const sessions = [session({ date: '2026-01-19' }), session({ date: '2026-12-28' })]
    expect(weekStreak(sessions, monday)).toBe(1)
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

describe('rirBucketCounts', () => {
  it('buckets 0-1 as hard, 2 as moderate, 3+ as easy, and ignores unlogged RIR', () => {
    const sessions = [
      session({
        entries: [{
          exerciseId: 'bench-press',
          sets: [{ weight: 60, reps: 8, rir: 0 }, { weight: 60, reps: 8, rir: 1 }, { weight: 60, reps: 8, rir: 2 }, { weight: 60, reps: 8, rir: 3 }, { weight: 60, reps: 8, rir: null }],
        }],
      }),
    ]
    expect(rirBucketCounts(sessions)).toEqual({ hard: 2, moderate: 1, easy: 1, total: 4 })
  })

  it('returns all zeros when nothing has RIR logged', () => {
    const sessions = [session({ entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8, rir: null }] }] })]
    expect(rirBucketCounts(sessions)).toEqual({ hard: 0, moderate: 0, easy: 0, total: 0 })
  })
})

describe('avgRirByMuscle', () => {
  it('averages RIR per primary muscle, sorted hardest-trained first', () => {
    const sessions = [
      session({
        entries: [
          // bench-press: primary Chest
          { exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8, rir: 0 }, { weight: 60, reps: 8, rir: 2 }] },
          // back-squat: primary Legs
          { exerciseId: 'back-squat', sets: [{ weight: 100, reps: 5, rir: 3 }] },
        ],
      }),
    ]
    const rows = avgRirByMuscle(sessions)
    expect(rows).toEqual([
      { muscle: 'Chest', avgRir: 1, sets: 2 },
      { muscle: 'Legs', avgRir: 3, sets: 1 },
    ])
  })

  it('excludes sets with no RIR logged from the average', () => {
    const sessions = [
      session({ entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8, rir: 2 }, { weight: 60, reps: 8, rir: null }] }] }),
    ]
    expect(avgRirByMuscle(sessions)).toEqual([{ muscle: 'Chest', avgRir: 2, sets: 1 }])
  })
})

describe('weeklySeries', () => {
  it('buckets sets/volume into Monday-start weeks, oldest to newest', () => {
    // A Wednesday and the following Monday — two different weeks.
    const sessions = [
      session({ date: '2026-01-07', entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 10 }] }] }), // Wed
      session({ date: '2026-01-12', entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }] }] }), // Mon
    ]
    const today = new Date('2026-01-12T12:00:00')
    const series = weeklySeries(sessions, 'sets', 2, today)
    expect(series).toHaveLength(2)
    expect(series[0].value).toBe(1)
    expect(series[1].value).toBe(2)
  })

  it('averages RIR within a week and reports 0 for a week with none logged', () => {
    const sessions = [
      session({ date: '2026-01-12', entries: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 10, rir: 1 }, { weight: 60, reps: 10, rir: 3 }] }] }),
    ]
    const today = new Date('2026-01-12T12:00:00')
    const series = weeklySeries(sessions, 'avgRir', 2, today)
    expect(series[0].value).toBe(0)
    expect(series[1].value).toBe(2)
  })
})

describe('acuteChronicLoad', () => {
  it('computes acute (7d) load against the trailing 4-week average, which includes the acute week itself', () => {
    const today = new Date('2026-02-01T12:00:00')
    const sessions = [
      // Acute window (last 7 days, inclusive of today) — also counts toward
      // the chronic 4-week average, matching the standard ACWR definition.
      session({ id: 'a', date: '2026-01-30', volume: 1000, entries: [] }),
      session({ id: 'b', date: '2026-01-10', volume: 2000, entries: [] }),
      session({ id: 'c', date: '2026-01-15', volume: 2000, entries: [] }),
    ]
    const result = acuteChronicLoad(sessions, today)
    expect(result.acuteLoad).toBe(1000)
    expect(result.chronicWeeklyAvg).toBe(1250) // (1000+2000+2000)/4 weeks
    expect(result.ratio).toBe(0.8)
    expect(result.hasBaseline).toBe(true)
  })

  it('reports no baseline when every session falls inside the acute window itself', () => {
    const today = new Date('2026-02-01T12:00:00')
    const sessions = [session({ date: '2026-01-30', volume: 1000, entries: [] })]
    const result = acuteChronicLoad(sessions, today)
    expect(result.hasBaseline).toBe(false)
  })

  it('reports null ratio when there is no training at all', () => {
    const result = acuteChronicLoad([], new Date('2026-02-01T12:00:00'))
    expect(result.ratio).toBeNull()
    expect(result.hasBaseline).toBe(false)
  })
})
