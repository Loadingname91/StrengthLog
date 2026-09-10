export function buildBackupFilename(date = new Date()) {
  return `strengthlog-backup-${date.toISOString().slice(0, 10)}.json`
}

// Structural check only — sessions/routines are the two fields
// buildInitialState() assumes present rather than backfilling, so they're
// what actually needs guarding against restoring an unrelated JSON file.
// Everything else is tolerated missing by the same backfill a normal app
// launch already goes through.
export function isValidBackup(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (!Array.isArray(value.sessions)) return false
  if (!Array.isArray(value.routines)) return false
  return true
}

export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'invalid-json' }
  }
  if (!isValidBackup(data)) return { ok: false, error: 'invalid-shape' }
  return { ok: true, data }
}
