import { describe, it, expect } from 'vitest'
import { bestProductForExercise, totalVolume, totalReps, totalSets, muscleSetCounts, exerciseSetCounts } from './selectors'

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
