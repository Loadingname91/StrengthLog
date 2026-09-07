import { MUSCLES, EQUIPMENT } from './muscles'
import { matchExercise } from './csvImport'
import { uid } from './id'

function slug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Parses raw rows against the user-confirmed column mapping into candidate
// rows the Preview step can flag, without committing anything yet — mirrors
// buildCandidates in csvImport.js.
export function buildRoutineCandidates(headers, rows, mapping, customExercises) {
  const idx = (field) => mapping.indexOf(field)
  const iRoutine = idx('Routine name')
  const iGroup = idx('Superset group')
  const iName = idx('Exercise name')
  const iSets = idx('Sets')
  const iRepMin = idx('Rep min')
  const iRepMax = idx('Rep max')
  const iRest = idx('Rest (sec)')
  const iRir = idx('RIR')
  const iTargetWeight = idx('Target weight')
  const iPrimary = idx('Primary muscle')
  const iSecondary = idx('Secondary muscle')
  const iEquipment = idx('Equipment')

  return rows.map((row, i) => {
    const routineName = iRoutine >= 0 ? row[iRoutine]?.trim() : ''
    const supersetGroup = iGroup >= 0 ? row[iGroup]?.trim() : ''
    const exerciseName = iName >= 0 ? row[iName]?.trim() : ''
    const sets = iSets >= 0 ? parseInt(row[iSets], 10) : NaN
    const repMin = iRepMin >= 0 ? parseInt(row[iRepMin], 10) : NaN
    const repMax = iRepMax >= 0 ? parseInt(row[iRepMax], 10) : NaN
    const rest = iRest >= 0 ? parseInt(row[iRest], 10) : NaN
    const rir = iRir >= 0 && row[iRir] !== '' ? Number(row[iRir]) : null
    const targetWeight = iTargetWeight >= 0 && row[iTargetWeight] !== '' ? Number(row[iTargetWeight]) : null
    const primary = iPrimary >= 0 ? row[iPrimary]?.trim() : ''
    const secondary = iSecondary >= 0 ? row[iSecondary]?.trim() : ''
    const equipment = iEquipment >= 0 ? row[iEquipment]?.trim() : ''

    const matched = exerciseName ? matchExercise(exerciseName, customExercises) : null

    const problems = []
    if (!routineName) problems.push('missing routine name')
    if (!exerciseName) problems.push('missing exercise name')
    if (!Number.isFinite(sets) || sets <= 0) problems.push('missing/invalid sets')
    if (!Number.isFinite(repMin) || repMin <= 0) problems.push('missing/invalid rep min')
    if (!Number.isFinite(repMax) || repMax <= 0) problems.push('missing/invalid rep max')
    if (Number.isFinite(repMin) && Number.isFinite(repMax) && repMax < repMin) problems.push('rep max below rep min')
    if (!Number.isFinite(rest) || rest < 0) problems.push('missing/invalid rest')
    if (primary && !MUSCLES.includes(primary)) problems.push('unrecognized primary muscle')
    if (secondary && !MUSCLES.includes(secondary)) problems.push('unrecognized secondary muscle')
    if (equipment && !EQUIPMENT.includes(equipment)) problems.push('unrecognized equipment')

    return {
      rowIndex: i,
      routineName,
      supersetGroup,
      exerciseName,
      matched,
      sets, repMin, repMax, rest, rir, targetWeight,
      primary, secondary, equipment,
      flagged: problems.length > 0,
      problems,
    }
  })
}

// Walks candidates in file order, collecting a definition for every exercise
// name that doesn't already match a known exercise. A name is resolved from
// whichever row first supplies a valid Primary muscle + Equipment for it —
// later rows referencing the same new name don't need to repeat them.
export function resolveNewExercises(candidates) {
  const defs = new Map() // lowercase name -> { name, primary, secondary, equipment }
  const unresolved = new Set()

  for (const c of candidates) {
    if (c.flagged || c.matched || !c.exerciseName) continue
    const key = c.exerciseName.toLowerCase()
    if (defs.has(key)) continue
    if (c.primary && MUSCLES.includes(c.primary) && c.equipment && EQUIPMENT.includes(c.equipment)) {
      defs.set(key, { name: c.exerciseName, primary: c.primary, secondary: c.secondary || null, equipment: c.equipment })
    } else {
      unresolved.add(key)
    }
  }
  // A later row might supply what an earlier one lacked — recheck once more.
  for (const c of candidates) {
    if (c.flagged || c.matched || !c.exerciseName) continue
    const key = c.exerciseName.toLowerCase()
    if (!defs.has(key) && c.primary && MUSCLES.includes(c.primary) && c.equipment && EQUIPMENT.includes(c.equipment)) {
      defs.set(key, { name: c.exerciseName, primary: c.primary, secondary: c.secondary || null, equipment: c.equipment })
      unresolved.delete(key)
    }
  }
  return { defs, unresolved }
}

// Turns validated candidates into routine objects ready for ADD_ROUTINE, plus
// the new custom exercises (ADD_CUSTOM_EXERCISE payloads) they depend on.
// Additive only — never touches existing routines. A row referencing an
// exercise that's neither matched nor resolvable is skipped (surfaced via
// `skipped`), same "silently drop what can't be built" contract as the
// workout importer.
export function finalizeRoutineImport(candidates, includeFlagged, existingRoutineCount = 0) {
  const { defs, unresolved } = resolveNewExercises(candidates)

  const usable = candidates.filter((c) => {
    if (!includeFlagged && c.flagged) return false
    if (!c.routineName || !c.exerciseName) return false
    if (!Number.isFinite(c.sets) || !Number.isFinite(c.repMin) || !Number.isFinite(c.repMax) || !Number.isFinite(c.rest)) return false
    if (!c.matched && unresolved.has(c.exerciseName.toLowerCase())) return false
    return true
  })

  const exerciseIdFor = (c) => c.matched?.id || `custom-${slug(c.exerciseName)}`

  const routines = []
  const routineIndex = new Map() // name -> index into routines
  for (const c of usable) {
    if (!routineIndex.has(c.routineName)) {
      routineIndex.set(c.routineName, routines.length)
      routines.push({ id: uid('routine'), name: c.routineName, blocks: [], blockIndex: new Map() })
    }
    const routine = routines[routineIndex.get(c.routineName)]
    const exerciseId = exerciseIdFor(c)
    const groupKey = c.supersetGroup || null

    if (groupKey && routine.blockIndex.has(groupKey)) {
      routine.blocks[routine.blockIndex.get(groupKey)].exerciseIds.push(exerciseId)
      continue
    }

    const block = {
      id: uid('block'),
      type: groupKey ? 'superset' : 'single',
      exerciseIds: [exerciseId],
      sets: c.sets,
      repMin: c.repMin,
      repMax: c.repMax,
      rest: c.rest,
      rir: c.rir,
      targetWeight: c.targetWeight,
    }
    routine.blocks.push(block)
    if (groupKey) routine.blockIndex.set(groupKey, routine.blocks.length - 1)
  }

  const finishedRoutines = routines.map((r, i) => ({
    id: r.id,
    name: r.name,
    position: `Session ${existingRoutineCount + i + 1} of ${existingRoutineCount + routines.length}`,
    blocks: r.blocks.map(({ id, type, exerciseIds, sets, repMin, repMax, rest, rir, targetWeight }) => ({ id, type, exerciseIds, sets, repMin, repMax, rest, rir, targetWeight })),
  }))

  const newExercises = [...defs.values()].map((d) => ({
    id: `custom-${slug(d.name)}`,
    name: d.name,
    aliases: [],
    primary: d.primary,
    secondary: d.secondary,
    equipment: d.equipment,
  }))

  return {
    routines: finishedRoutines,
    newExercises,
    importedExercises: usable.length,
    skipped: candidates.length - usable.length,
  }
}
