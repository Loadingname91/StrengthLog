// Minimal RFC4180-ish CSV parser/writer — good enough for workout-log
// exports (quoted fields, commas, escaped quotes) without pulling in a
// dependency.
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  if (!rows.length) return { headers: [], rows: [] }
  const [headers, ...body] = rows
  return { headers: headers.map((h) => h.trim()), rows: body }
}

export function toCSV(headers, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
}

export const IMPORT_FIELDS = ['Exercise name', 'Date', 'Set #', 'Weight', 'Reps', 'RIR', 'Notes', 'Ignore this column']

const HEADER_GUESSES = {
  'Exercise name': ['exercise', 'exercise_title', 'exercise name', 'movement', 'lift'],
  Date: ['date', 'workout_date', 'day'],
  'Set #': ['set', 'set #', 'set_number', 'set_index'],
  Weight: ['weight', 'kg', 'lb', 'load'],
  Reps: ['reps', 'repetitions', 'rep_count'],
  RIR: ['rir', 'rpe'],
  Notes: ['notes', 'comment', 'comments'],
}

export function guessMapping(headers) {
  return headers.map((h) => {
    const lower = h.toLowerCase()
    for (const [field, guesses] of Object.entries(HEADER_GUESSES)) {
      if (guesses.some((g) => lower === g || lower.includes(g))) return field
    }
    return 'Ignore this column'
  })
}

// Routine import: one row per exercise-in-a-block. "Superset group" is a
// short label shared by 2+ consecutive rows within the same routine to
// merge them into one superset block — blank means its own single-exercise
// block. "Primary muscle"/"Secondary muscle"/"Equipment" are only read when
// "Exercise name" doesn't match anything already known (built-in or
// previously imported), so a brand-new exercise can be defined inline
// instead of needing a separate import step.
export const ROUTINE_IMPORT_FIELDS = [
  'Routine name', 'Superset group', 'Exercise name', 'Sets', 'Rep min', 'Rep max', 'Rest (sec)', 'RIR', 'Target weight',
  'Primary muscle', 'Secondary muscle', 'Equipment', 'Ignore this column',
]

const ROUTINE_HEADER_GUESSES = {
  'Routine name': ['routine', 'routine name', 'workout', 'workout name', 'day'],
  'Superset group': ['superset', 'superset group', 'group', 'pair'],
  'Exercise name': ['exercise', 'exercise name', 'movement', 'lift'],
  Sets: ['sets', 'set count', 'num sets'],
  'Rep min': ['rep min', 'reps min', 'min reps', 'rep_min'],
  'Rep max': ['rep max', 'reps max', 'max reps', 'rep_max'],
  'Rest (sec)': ['rest', 'rest sec', 'rest (sec)', 'rest_seconds'],
  RIR: ['rir', 'rpe'],
  'Target weight': ['target weight', 'target_weight', 'weight'],
  'Primary muscle': ['primary muscle', 'primary', 'muscle'],
  'Secondary muscle': ['secondary muscle', 'secondary'],
  Equipment: ['equipment', 'gear'],
}

export function guessRoutineMapping(headers) {
  return headers.map((h) => {
    const lower = h.toLowerCase()
    for (const [field, guesses] of Object.entries(ROUTINE_HEADER_GUESSES)) {
      if (guesses.some((g) => lower === g || lower.includes(g))) return field
    }
    return 'Ignore this column'
  })
}

export function downloadTextFile(filename, mime, content) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
