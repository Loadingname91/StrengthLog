import { describe, it, expect } from 'vitest'
import { buildRoutineCandidates, resolveNewExercises, finalizeRoutineImport } from './routineCsvImport'
import { ROUTINE_IMPORT_FIELDS, parseCSV, guessRoutineMapping } from './csv'

function parse(csvText) {
  const { headers, rows } = parseCSV(csvText)
  const mapping = guessRoutineMapping(headers)
  return { headers, rows, mapping }
}

describe('guessRoutineMapping', () => {
  it('maps common header spellings to the canonical fields', () => {
    const { headers } = parseCSV('Routine,Superset,Movement,Sets,Rep min,Rep max,Rest,RIR,Target weight,Primary,Secondary,Equipment\n')
    expect(guessRoutineMapping(headers)).toEqual(ROUTINE_IMPORT_FIELDS.filter((f) => f !== 'Ignore this column'))
  })

  it('falls back to Ignore this column for anything unrecognized', () => {
    const { headers } = parseCSV('Routine name,Notes\n')
    expect(guessRoutineMapping(headers)).toEqual(['Routine name', 'Ignore this column'])
  })
})

describe('buildRoutineCandidates', () => {
  it('matches a known built-in exercise by name', () => {
    const { headers, rows, mapping } = parse('Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec)\nPush Day,Bench Press,3,8,12,90\n')
    const [c] = buildRoutineCandidates(headers, rows, mapping, [])
    expect(c.matched?.id).toBe('bench-press')
    expect(c.flagged).toBe(false)
  })

  it('flags missing required fields', () => {
    const { headers, rows, mapping } = parse('Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec)\n,Bench Press,,8,12,90\n')
    const [c] = buildRoutineCandidates(headers, rows, mapping, [])
    expect(c.flagged).toBe(true)
    expect(c.problems).toContain('missing routine name')
    expect(c.problems).toContain('missing/invalid sets')
  })

  it('flags rep max below rep min', () => {
    const { headers, rows, mapping } = parse('Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec)\nPush Day,Bench Press,3,12,8,90\n')
    const [c] = buildRoutineCandidates(headers, rows, mapping, [])
    expect(c.problems).toContain('rep max below rep min')
  })

  it('flags an unrecognized muscle or equipment value', () => {
    const csv = 'Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec),Primary muscle,Equipment\nPush Day,Cool New Move,3,8,12,90,Forearms,Resistance Band\n'
    const { headers, rows, mapping } = parse(csv)
    const [c] = buildRoutineCandidates(headers, rows, mapping, [])
    expect(c.problems).toContain('unrecognized primary muscle')
    expect(c.problems).toContain('unrecognized equipment')
  })

  it('leaves an unmatched exercise with no muscle/equipment simply unmatched, not flagged by itself', () => {
    const { headers, rows, mapping } = parse('Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec)\nPush Day,Cool New Move,3,8,12,90\n')
    const [c] = buildRoutineCandidates(headers, rows, mapping, [])
    expect(c.matched).toBeUndefined()
    expect(c.flagged).toBe(false)
  })
})

describe('resolveNewExercises', () => {
  it('resolves a new exercise from the row that defines it', () => {
    const csv = 'Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec),Primary muscle,Equipment\nPush Day,Landmine Press,3,8,12,90,Shoulders,Barbell\n'
    const { headers, rows, mapping } = parse(csv)
    const candidates = buildRoutineCandidates(headers, rows, mapping, [])
    const { defs, unresolved } = resolveNewExercises(candidates)
    expect(defs.get('landmine press')).toEqual({ name: 'Landmine Press', primary: 'Shoulders', secondary: null, equipment: 'Barbell' })
    expect(unresolved.size).toBe(0)
  })

  it('carries a definition from one row to a later row referencing the same new exercise', () => {
    const csv = [
      'Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec),Primary muscle,Equipment',
      'Push Day,Landmine Press,3,8,12,90,Shoulders,Barbell',
      'Pull Day,Landmine Press,4,6,10,120,,',
    ].join('\n') + '\n'
    const { headers, rows, mapping } = parse(csv)
    const candidates = buildRoutineCandidates(headers, rows, mapping, [])
    const { unresolved } = resolveNewExercises(candidates)
    expect(unresolved.size).toBe(0)
  })

  it('reports an unresolved name when no row ever supplies muscle + equipment', () => {
    const { headers, rows, mapping } = parse('Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec)\nPush Day,Cool New Move,3,8,12,90\n')
    const candidates = buildRoutineCandidates(headers, rows, mapping, [])
    const { unresolved } = resolveNewExercises(candidates)
    expect(unresolved.has('cool new move')).toBe(true)
  })
})

describe('finalizeRoutineImport', () => {
  it('builds one single-exercise block per row with no superset group', () => {
    const csv = 'Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec)\nPush Day,Bench Press,3,8,12,90\nPush Day,Overhead Press,3,8,12,90\n'
    const { headers, rows, mapping } = parse(csv)
    const candidates = buildRoutineCandidates(headers, rows, mapping, [])

    const outcome = finalizeRoutineImport(candidates, false)

    expect(outcome.routines).toHaveLength(1)
    expect(outcome.routines[0].blocks).toHaveLength(2)
    expect(outcome.routines[0].blocks[0]).toMatchObject({ type: 'single', exerciseIds: ['bench-press'], sets: 3, repMin: 8, repMax: 12, rest: 90 })
    expect(outcome.routines[0].blocks[1].exerciseIds).toEqual(['overhead-press'])
  })

  it('merges rows sharing a superset group into one block, in file order', () => {
    const csv = [
      'Routine name,Superset group,Exercise name,Sets,Rep min,Rep max,Rest (sec)',
      'Push Day,A,Bench Press,3,8,12,90',
      'Push Day,A,Cable Fly,3,8,12,90',
    ].join('\n') + '\n'
    const { headers, rows, mapping } = parse(csv)
    const candidates = buildRoutineCandidates(headers, rows, mapping, [])

    const outcome = finalizeRoutineImport(candidates, false)

    expect(outcome.routines[0].blocks).toHaveLength(1)
    expect(outcome.routines[0].blocks[0]).toMatchObject({ type: 'superset', exerciseIds: ['bench-press', 'cable-fly'] })
  })

  it('splits rows into separate routines by routine name, preserving file order', () => {
    const csv = 'Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec)\nPull Day,Barbell Row,3,8,12,90\nPush Day,Bench Press,3,8,12,90\n'
    const { headers, rows, mapping } = parse(csv)
    const candidates = buildRoutineCandidates(headers, rows, mapping, [])

    const outcome = finalizeRoutineImport(candidates, false)

    expect(outcome.routines.map((r) => r.name)).toEqual(['Pull Day', 'Push Day'])
  })

  it('creates a new custom exercise for an unmatched, resolvable name, reusing the same id in its block', () => {
    const csv = 'Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec),Primary muscle,Equipment\nPush Day,Landmine Press,3,8,12,90,Shoulders,Barbell\n'
    const { headers, rows, mapping } = parse(csv)
    const candidates = buildRoutineCandidates(headers, rows, mapping, [])

    const outcome = finalizeRoutineImport(candidates, false)

    expect(outcome.newExercises).toEqual([{ id: 'custom-landmine-press', name: 'Landmine Press', aliases: [], primary: 'Shoulders', secondary: null, equipment: 'Barbell' }])
    expect(outcome.routines[0].blocks[0].exerciseIds).toEqual(['custom-landmine-press'])
  })

  it('skips a row referencing an unresolved new exercise, and counts it', () => {
    const csv = 'Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec)\nPush Day,Bench Press,3,8,12,90\nPush Day,Cool New Move,3,8,12,90\n'
    const { headers, rows, mapping } = parse(csv)
    const candidates = buildRoutineCandidates(headers, rows, mapping, [])

    const outcome = finalizeRoutineImport(candidates, false)

    expect(outcome.routines[0].blocks).toHaveLength(1)
    expect(outcome.importedExercises).toBe(1)
    expect(outcome.skipped).toBe(1)
  })

  it('numbers imported routines after any that already exist', () => {
    const csv = 'Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec)\nPush Day,Bench Press,3,8,12,90\n'
    const { headers, rows, mapping } = parse(csv)
    const candidates = buildRoutineCandidates(headers, rows, mapping, [])

    const outcome = finalizeRoutineImport(candidates, false, 2)

    expect(outcome.routines[0].position).toBe('Session 3 of 3')
  })

  it('matches an already-existing custom exercise instead of creating a duplicate', () => {
    const customExercises = [{ id: 'custom-landmine-press', name: 'Landmine Press', aliases: [], primary: 'Shoulders', secondary: null, equipment: 'Barbell' }]
    const csv = 'Routine name,Exercise name,Sets,Rep min,Rep max,Rest (sec)\nPush Day,Landmine Press,3,8,12,90\n'
    const { headers, rows, mapping } = parse(csv)
    const candidates = buildRoutineCandidates(headers, rows, mapping, customExercises)

    const outcome = finalizeRoutineImport(candidates, false)

    expect(outcome.newExercises).toEqual([])
    expect(outcome.routines[0].blocks[0].exerciseIds).toEqual(['custom-landmine-press'])
  })
})
