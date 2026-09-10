import { describe, it, expect } from 'vitest'
import {
  backfillSequence,
  sequenceSetCount,
  sequenceRestTotal,
  normalizeBlock,
  getBlockExercises,
  getBlockTotalSets,
  getBlockTotalReps,
  estimateBlockDurationSeconds,
} from './blocks'

describe('backfillSequence', () => {
  it('builds a set/rest sequence for a single-exercise block, no trailing rest', () => {
    const block = { type: 'single', sets: 3, rest: 90 }
    const result = backfillSequence(block)
    expect(result.sequence).toEqual([
      { type: 'set' },
      { type: 'rest', seconds: 90 },
      { type: 'set' },
      { type: 'rest', seconds: 90 },
      { type: 'set' },
    ])
  })

  it('builds a round/rest sequence for a superset block', () => {
    const block = { type: 'superset', sets: 2, rest: 120 }
    const result = backfillSequence(block)
    expect(result.sequence).toEqual([
      { type: 'round' },
      { type: 'rest', seconds: 120 },
      { type: 'round' },
    ])
  })

  it('returns the block unchanged (same reference) when it already has a sequence', () => {
    const block = { type: 'single', sequence: [{ type: 'set' }] }
    expect(backfillSequence(block)).toBe(block)
  })

  it('handles a single set with no rest steps', () => {
    const block = { type: 'single', sets: 1, rest: 90 }
    const result = backfillSequence(block)
    expect(result.sequence).toEqual([{ type: 'set' }])
  })
})

describe('sequenceSetCount', () => {
  it('counts only non-rest steps', () => {
    const sequence = [{ type: 'set' }, { type: 'rest', seconds: 90 }, { type: 'set' }, { type: 'rest', seconds: 90 }, { type: 'set' }]
    expect(sequenceSetCount(sequence)).toBe(3)
  })

  it('counts round steps the same as set steps', () => {
    const sequence = [{ type: 'round' }, { type: 'rest', seconds: 120 }, { type: 'round' }]
    expect(sequenceSetCount(sequence)).toBe(2)
  })
})

describe('sequenceRestTotal', () => {
  it('sums only rest step durations', () => {
    const sequence = [{ type: 'set' }, { type: 'rest', seconds: 90 }, { type: 'set' }, { type: 'rest', seconds: 60 }, { type: 'set' }]
    expect(sequenceRestTotal(sequence)).toBe(150)
  })

  it('returns 0 when there are no rest steps', () => {
    expect(sequenceRestTotal([{ type: 'set' }])).toBe(0)
  })
})

describe('normalizeBlock', () => {
  it('normalizes single blocks properly', () => {
    const block = { id: 'b1', type: 'single', exerciseIds: ['bench-press'], sets: 2, rest: 60, repMin: 8, repMax: 12 }
    const norm = normalizeBlock(block)
    expect(norm.type).toBe('single')
    expect(norm.exerciseIds).toEqual(['bench-press'])
    expect(norm.sequence).toEqual([{ type: 'set' }, { type: 'rest', seconds: 60 }, { type: 'set' }])
  })

  it('migrates legacy flat superset block to per-exercise exercises array', () => {
    const legacy = {
      id: 'b2',
      type: 'superset',
      exerciseIds: ['bench-press', 'cable-fly'],
      sets: 2,
      rest: 90,
      repMin: 8,
      repMax: 12,
      rir: 2,
      targetWeight: 80,
    }
    const norm = normalizeBlock(legacy)
    expect(norm.type).toBe('superset')
    expect(norm.exerciseIds).toEqual(['bench-press', 'cable-fly'])
    expect(norm.exercises).toHaveLength(2)
    expect(norm.exercises[0]).toMatchObject({
      exerciseId: 'bench-press',
      repMin: 8,
      repMax: 12,
      rir: 2,
      targetWeight: 80,
      sequence: [{ type: 'set' }, { type: 'rest', seconds: 90 }, { type: 'set' }],
    })
    expect(norm.exercises[1]).toMatchObject({
      exerciseId: 'cable-fly',
      repMin: 8,
      repMax: 12,
      rir: 2,
      targetWeight: 80,
      sequence: [{ type: 'set' }, { type: 'rest', seconds: 90 }, { type: 'set' }],
    })
  })

  it('preserves modern superset block with individual exercises', () => {
    const modern = {
      id: 'b3',
      type: 'superset',
      exerciseIds: ['bench-press', 'cable-fly'],
      exercises: [
        { exerciseId: 'bench-press', repMin: 6, repMax: 8, rir: 1, targetWeight: 100, sets: 3, rest: 120 },
        { exerciseId: 'cable-fly', repMin: 12, repMax: 15, rir: 2, targetWeight: 20, sets: 2, rest: 60 },
      ],
    }
    const norm = normalizeBlock(modern)
    expect(norm.exercises[0].repMin).toBe(6)
    expect(norm.exercises[0].sequence).toHaveLength(5) // 3 sets + 2 rests
    expect(norm.exercises[1].repMin).toBe(12)
    expect(norm.exercises[1].sequence).toHaveLength(3) // 2 sets + 1 rest
  })
})

describe('getBlockExercises and aggregation helpers', () => {
  const unevenSuperset = {
    id: 'b4',
    type: 'superset',
    exercises: [
      { exerciseId: 'bench-press', repMin: 8, repMax: 12, sequence: [{ type: 'set' }, { type: 'rest', seconds: 60 }, { type: 'set' }, { type: 'rest', seconds: 60 }, { type: 'set' }] }, // 3 sets, avg 10 reps
      { exerciseId: 'cable-fly', repMin: 10, repMax: 14, sequence: [{ type: 'set' }, { type: 'rest', seconds: 45 }, { type: 'set' }] }, // 2 sets, avg 12 reps
    ],
  }

  it('getBlockExercises returns per-exercise array', () => {
    const list = getBlockExercises(unevenSuperset)
    expect(list).toHaveLength(2)
    expect(list[0].exerciseId).toBe('bench-press')
    expect(list[1].exerciseId).toBe('cable-fly')
  })

  it('getBlockTotalSets sums sets across all exercises', () => {
    expect(getBlockTotalSets(unevenSuperset)).toBe(5)
  })

  it('getBlockTotalReps computes reps based on individual rep ranges', () => {
    // 3 * 10 = 30; 2 * 12 = 24 => total 54
    expect(getBlockTotalReps(unevenSuperset)).toBe(54)
  })

  it('estimateBlockDurationSeconds calculates work and round rests for uneven superset', () => {
    const duration = estimateBlockDurationSeconds(unevenSuperset)
    // Work: 5 sets * 50 = 250s
    // Round rests: max 3 rounds => round 0 rest (60s), round 1 rest (60s), round 2 is final round (no rest) = 120s
    // Total = 370s
    expect(duration).toBe(370)
  })
})
