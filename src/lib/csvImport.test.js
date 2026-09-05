import { describe, it, expect } from 'vitest'
import { matchExercise, detectUnit, buildCandidates, finalizeImport } from './csvImport'

describe('matchExercise', () => {
  it('matches by exact name, case-insensitively', () => {
    const match = matchExercise('bench press', [])
    expect(match?.id).toBe('bench-press')
  })

  it('matches by alias', () => {
    const match = matchExercise('BB Bench', [])
    expect(match?.id).toBe('bench-press')
  })

  it('matches a custom exercise', () => {
    const custom = [{ id: 'custom-1', name: 'Zercher Squat', aliases: [] }]
    const match = matchExercise('zercher squat', custom)
    expect(match?.id).toBe('custom-1')
  })

  it('returns undefined when nothing matches', () => {
    expect(matchExercise('not a real exercise', [])).toBeUndefined()
  })
})

describe('detectUnit', () => {
  it('detects kg from the weight column header', () => {
    const headers = ['Date', 'Weight (kg)', 'Reps']
    const mapping = ['Date', 'Weight', 'Reps']
    expect(detectUnit(headers, mapping)).toBe('kg')
  })

  it('detects lb from the weight column header', () => {
    const headers = ['Date', 'Weight (lb)', 'Reps']
    const mapping = ['Date', 'Weight', 'Reps']
    expect(detectUnit(headers, mapping)).toBe('lb')
  })

  it('returns null when no weight column is mapped', () => {
    const headers = ['Date', 'Reps']
    const mapping = ['Date', 'Reps']
    expect(detectUnit(headers, mapping)).toBeNull()
  })

  it('returns null when the weight header has no unit hint', () => {
    const headers = ['Date', 'Weight', 'Reps']
    const mapping = ['Date', 'Weight', 'Reps']
    expect(detectUnit(headers, mapping)).toBeNull()
  })
})

describe('buildCandidates', () => {
  const headers = ['Date', 'Exercise', 'Set', 'Weight', 'Reps']
  const mapping = ['Date', 'Exercise name', 'Set #', 'Weight', 'Reps']

  it('flags rows missing required fields', () => {
    const rows = [['2026-01-01', '', '1', '60', '10']]
    const [candidate] = buildCandidates(headers, rows, mapping, [])
    expect(candidate.flagged).toBe(true)
    expect(candidate.problems).toContain('missing exercise')
  })

  it('builds a clean, unflagged candidate from a valid row', () => {
    const rows = [['2026-01-01', 'Bench Press', '1', '60', '10']]
    const [candidate] = buildCandidates(headers, rows, mapping, [])
    expect(candidate.flagged).toBe(false)
    expect(candidate.exerciseName).toBe('Bench Press')
    expect(candidate.matched?.id).toBe('bench-press')
    expect(candidate.weight).toBe(60)
    expect(candidate.reps).toBe(10)
    expect(candidate.date).toBe('2026-01-01')
  })

  it('flags an unparseable date', () => {
    const rows = [['not-a-date', 'Bench Press', '1', '60', '10']]
    const [candidate] = buildCandidates(headers, rows, mapping, [])
    expect(candidate.flagged).toBe(true)
    expect(candidate.problems).toContain('bad date')
  })
})

describe('finalizeImport', () => {
  function candidate(overrides = {}) {
    return {
      rowIndex: 0,
      exerciseName: 'Bench Press',
      matched: { id: 'bench-press' },
      date: '2026-01-01',
      set: '1',
      weight: 60,
      reps: 10,
      rir: null,
      notes: '',
      flagged: false,
      problems: [],
      ...overrides,
    }
  }

  it('groups sets by date and exercise into sessions', () => {
    const candidates = [
      candidate({ weight: 60, reps: 10 }),
      candidate({ weight: 62.5, reps: 8 }),
    ]
    const result = finalizeImport(candidates, 'kg', false)

    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0].date).toBe('2026-01-01')
    expect(result.sessions[0].entries).toHaveLength(1)
    expect(result.sessions[0].entries[0].sets).toHaveLength(2)
    expect(result.importedSets).toBe(2)
    expect(result.skipped).toBe(0)
  })

  it('excludes flagged rows unless includeFlagged is set', () => {
    const candidates = [candidate(), candidate({ flagged: true, weight: NaN })]
    const excluded = finalizeImport(candidates, 'kg', false)
    expect(excluded.importedSets).toBe(1)
    expect(excluded.skipped).toBe(1)
  })

  it('converts lb to kg', () => {
    const candidates = [candidate({ weight: 100 })]
    const result = finalizeImport(candidates, 'lb', false)
    const [set] = result.sessions[0].entries[0].sets
    expect(set.weight).toBeCloseTo(45.4, 1)
  })

  it('collects unmatched exercise names for custom-exercise creation', () => {
    const candidates = [candidate({ exerciseName: 'Zercher Squat', matched: null })]
    const result = finalizeImport(candidates, 'kg', false)
    expect(result.newExerciseNames).toEqual(['Zercher Squat'])
  })
})
