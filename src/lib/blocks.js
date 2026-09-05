// Backfill for routines saved before the sequence field existed: a block
// used to carry a flat `sets: N` count and a single `rest` duration. Rather
// than rewriting persisted data, every reader derives a sequence on the fly
// — mirrors the lazy backfill StoreContext.jsx already uses for
// weekdayAssignments/scheduleRestartAt.
export function backfillSequence(block) {
  if (block.sequence) return block
  const stepType = block.type === 'superset' ? 'round' : 'set'
  const sequence = []
  for (let i = 0; i < block.sets; i++) {
    sequence.push({ type: stepType })
    if (i < block.sets - 1) sequence.push({ type: 'rest', seconds: block.rest })
  }
  return { ...block, sequence }
}

export function sequenceSetCount(sequence) {
  return sequence.filter((s) => s.type !== 'rest').length
}

export function sequenceRestTotal(sequence) {
  return sequence.filter((s) => s.type === 'rest').reduce((sum, s) => sum + s.seconds, 0)
}
