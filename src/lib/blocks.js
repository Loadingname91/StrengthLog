// Backfill for routines saved before the sequence field existed: a block
// used to carry a flat `sets: N` count and a single `rest` duration. Rather
// than rewriting persisted data, every reader derives a sequence on the fly
// — mirrors the lazy backfill StoreContext.jsx already uses for
// weekdayAssignments/scheduleRestartAt.
export function backfillSequence(block) {
  if (!block) return block
  if (block.sequence) return block
  const stepType = block.type === 'superset' ? 'round' : 'set'
  const count = block.sets ?? 1
  const restSec = block.rest ?? 90
  const sequence = []
  for (let i = 0; i < count; i++) {
    sequence.push({ type: stepType })
    if (i < count - 1) sequence.push({ type: 'rest', seconds: restSec })
  }
  return { ...block, sequence }
}

export function sequenceSetCount(sequence) {
  if (!Array.isArray(sequence)) return 0
  return sequence.filter((s) => s.type !== 'rest').length
}

export function sequenceRestTotal(sequence) {
  if (!Array.isArray(sequence)) return 0
  return sequence.filter((s) => s.type === 'rest').reduce((sum, s) => sum + (s.seconds || 0), 0)
}

// Normalizes any block into the modern schema:
// - Single blocks carry exerciseIds: [id], repMin, repMax, rir, targetWeight, sequence
// - Superset blocks carry exerciseIds: [...], and exercises: [{ exerciseId, repMin, repMax, rir, targetWeight, sequence }, ...]
// Legacy blocks (where superset had flat repMin/sets/sequence) are migrated seamlessly.
export function normalizeBlock(block) {
  if (!block) return block
  const isSuperset = block.type === 'superset' || (!block.type && ((block.exerciseIds?.length || 0) > 1 || (block.exercises?.length || 0) > 1))
  if (isSuperset) {
    if (Array.isArray(block.exercises) && block.exercises.length > 0) {
      const exercises = block.exercises.map((ex) => {
        const exWithSeq = backfillSequence(ex)
        return {
          exerciseId: ex.exerciseId,
          repMin: ex.repMin ?? 8,
          repMax: ex.repMax ?? 12,
          rir: ex.rir ?? null,
          targetWeight: ex.targetWeight ?? null,
          sequence: (exWithSeq.sequence || [{ type: 'set' }]).map((s) =>
            s.type === 'round' ? { type: 'set' } : { ...s }
          ),
        }
      })
      return {
        ...block,
        type: 'superset',
        exerciseIds: exercises.map((e) => e.exerciseId),
        exercises,
      }
    }

    // Legacy superset: flat properties on block
    const baseSeq = block.sequence || backfillSequence(block).sequence || [{ type: 'round' }]
    const exerciseSeq = baseSeq.map((s) => (s.type === 'round' ? { type: 'set' } : { ...s }))
    const exerciseIds = Array.isArray(block.exerciseIds) && block.exerciseIds.length > 0
      ? block.exerciseIds
      : (block.exerciseId ? [block.exerciseId] : [])
    const exercises = exerciseIds.map((id) => ({
      exerciseId: id,
      repMin: block.repMin ?? 8,
      repMax: block.repMax ?? 12,
      rir: block.rir ?? null,
      targetWeight: block.targetWeight ?? null,
      sequence: exerciseSeq.map((s) => ({ ...s })),
    }))
    return {
      ...block,
      type: 'superset',
      exerciseIds: exercises.map((e) => e.exerciseId),
      exercises,
    }
  }

  // Single block
  const b = backfillSequence(block)
  return {
    ...b,
    type: 'single',
    exerciseIds: b.exerciseIds || (b.exerciseId ? [b.exerciseId] : []),
  }
}

// Uniformly returns an array of per-exercise objects for any block (single or superset)
export function getBlockExercises(block) {
  const norm = normalizeBlock(block)
  if (norm.type === 'superset') {
    return norm.exercises
  }
  return [
    {
      exerciseId: norm.exerciseIds[0],
      repMin: norm.repMin,
      repMax: norm.repMax,
      rir: norm.rir,
      targetWeight: norm.targetWeight ?? null,
      sequence: norm.sequence,
    },
  ]
}

export function getBlockTotalSets(block) {
  const exList = getBlockExercises(block)
  return exList.reduce((sum, ex) => sum + sequenceSetCount(ex.sequence), 0)
}

export function getBlockTotalReps(block) {
  const exList = getBlockExercises(block)
  return exList.reduce((sum, ex) => {
    const sets = sequenceSetCount(ex.sequence)
    const avgReps = Math.round(((ex.repMin || 0) + (ex.repMax || 0)) / 2)
    return sum + sets * avgReps
  }, 0)
}

export function estimateBlockDurationSeconds(block) {
  const norm = normalizeBlock(block)
  const exList = getBlockExercises(norm)
  const workSec = getBlockTotalSets(norm) * 50
  let restSec = 0
  if (norm.type === 'superset') {
    const maxRounds = Math.max(...exList.map((e) => sequenceSetCount(e.sequence)), 0)
    for (let r = 0; r < maxRounds - 1; r++) {
      let roundRest = null
      for (const ex of exList) {
        let setIdx = 0
        for (let i = 0; i < ex.sequence.length; i++) {
          if (ex.sequence[i].type !== 'rest') {
            if (setIdx === r && ex.sequence[i + 1]?.type === 'rest') {
              roundRest = ex.sequence[i + 1].seconds
              break
            }
            setIdx++
          }
        }
        if (roundRest != null) break
      }
      restSec += roundRest ?? 90
    }
  } else {
    restSec = sequenceRestTotal(norm.sequence)
  }
  return workSec + restSec
}


