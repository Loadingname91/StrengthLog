import { describe, it, expect } from 'vitest'
import { backfillSequence, sequenceSetCount, sequenceRestTotal } from './blocks'

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
