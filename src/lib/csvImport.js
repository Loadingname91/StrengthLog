import { EXERCISES } from './exercises'
import { uid } from './id'

function slug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function matchExercise(name, customExercises) {
  const norm = name.trim().toLowerCase()
  const all = [...EXERCISES, ...customExercises]
  return all.find((e) => e.name.toLowerCase() === norm || e.aliases.some((a) => a.toLowerCase() === norm))
}

export function detectUnit(headers, mapping) {
  const weightCol = headers[mapping.indexOf('Weight')]
  if (!weightCol) return null
  const lower = weightCol.toLowerCase()
  if (lower.includes('kg')) return 'kg'
  if (lower.includes('lb')) return 'lb'
  return null
}

const LB_TO_KG = 0.453592

// Parses raw rows against the user-confirmed column mapping into candidate
// rows the Preview step can flag, without committing anything yet.
export function buildCandidates(headers, rows, mapping, customExercises) {
  const idx = (field) => mapping.indexOf(field)
  const iName = idx('Exercise name')
  const iDate = idx('Date')
  const iSet = idx('Set #')
  const iWeight = idx('Weight')
  const iReps = idx('Reps')
  const iRir = idx('RIR')
  const iNotes = idx('Notes')

  return rows.map((row, i) => {
    const name = iName >= 0 ? row[iName]?.trim() : ''
    const dateRaw = iDate >= 0 ? row[iDate]?.trim() : ''
    const weightRaw = iWeight >= 0 ? row[iWeight]?.trim() : ''
    const repsRaw = iReps >= 0 ? row[iReps]?.trim() : ''

    const weight = parseFloat(weightRaw)
    const reps = parseInt(repsRaw, 10)
    const date = dateRaw && !Number.isNaN(new Date(dateRaw).getTime()) ? new Date(dateRaw).toISOString().slice(0, 10) : null

    const problems = []
    if (!name) problems.push('missing exercise')
    if (!Number.isFinite(weight)) problems.push('missing weight')
    if (!Number.isFinite(reps)) problems.push('missing reps')
    if (!date) problems.push('bad date')

    return {
      rowIndex: i,
      exerciseName: name,
      matched: name ? matchExercise(name, customExercises) : null,
      date,
      set: iSet >= 0 ? row[iSet] : String(i + 1),
      weight, reps,
      rir: iRir >= 0 && row[iRir] !== '' ? Number(row[iRir]) : null,
      notes: iNotes >= 0 ? row[iNotes] : '',
      flagged: problems.length > 0,
      problems,
    }
  })
}

// Turns validated candidates into session objects ready for IMPORT_SESSIONS,
// and the list of exercise names that need a new custom exercise created
// first. Additive only — never touches existing sessions.
export function finalizeImport(candidates, unit, includeFlagged) {
  const usable = candidates.filter((c) => includeFlagged || !c.flagged)
  const usableComplete = usable.filter((c) => c.exerciseName && Number.isFinite(c.weight) && Number.isFinite(c.reps))

  const newExerciseNames = [...new Set(usableComplete.filter((c) => !c.matched).map((c) => c.exerciseName))]
  const idFor = (c) => c.matched?.id || `custom-${slug(c.exerciseName)}`

  const byDate = new Map()
  for (const c of usableComplete) {
    const date = c.date || new Date().toISOString().slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, new Map())
    const byExercise = byDate.get(date)
    const exId = idFor(c)
    if (!byExercise.has(exId)) byExercise.set(exId, [])
    const weight = unit === 'lb' ? Math.round(c.weight * LB_TO_KG * 10) / 10 : c.weight
    byExercise.get(exId).push({ weight, reps: c.reps, rir: c.rir, isPR: false, notes: c.notes })
  }

  const sessions = [...byDate.entries()].map(([date, byExercise]) => {
    const entries = [...byExercise.entries()].map(([exerciseId, sets]) => ({ exerciseId, blockId: 'import', sets }))
    const volume = entries.reduce((s, e) => s + e.sets.reduce((a, x) => a + x.weight * x.reps, 0), 0)
    return {
      id: uid('imported'),
      routineId: null,
      routineName: 'Imported',
      date,
      startedAt: `${date}T12:00:00.000Z`,
      finishedAt: `${date}T12:00:00.000Z`,
      durationSec: 0,
      note: 'Imported from CSV',
      entries,
      volume: Math.round(volume),
      prCount: 0,
    }
  })

  return {
    sessions,
    newExerciseNames,
    importedSets: usableComplete.length,
    skipped: candidates.length - usableComplete.length,
  }
}
