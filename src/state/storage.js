const KEY = 'fitlog:v1'
const CORRUPT_BACKUP_KEY = 'fitlog:v1:corrupted-backup'

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // The blob exists but isn't valid JSON — returning null here makes the
    // caller build a fresh empty state, and the very next save would
    // otherwise permanently overwrite this key with it, destroying data
    // that might still be mostly intact. Preserve the raw blob under a
    // separate key first so it isn't lost forever, even though there's no
    // automatic recovery path for it yet.
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) localStorage.setItem(CORRUPT_BACKUP_KEY, raw)
    } catch {
      // best-effort only — if this also fails there's nothing more to do
    }
    return null
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full or unavailable — state still lives in memory for this session
  }
}
