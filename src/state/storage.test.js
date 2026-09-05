import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState } from './storage'

const KEY = 'fitlog:v1'
const BACKUP_KEY = 'fitlog:v1:corrupted-backup'

describe('loadState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(loadState()).toBeNull()
  })

  it('parses and returns a valid stored blob', () => {
    const data = { routines: [{ id: 'r1' }] }
    localStorage.setItem(KEY, JSON.stringify(data))
    expect(loadState()).toEqual(data)
  })

  it('preserves a corrupted blob under a backup key instead of silently discarding it', () => {
    localStorage.setItem(KEY, '{not valid json')

    const result = loadState()

    expect(result).toBeNull()
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{not valid json')
  })
})

describe('saveState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('serializes state to the storage key', () => {
    saveState({ routines: [] })
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ routines: [] })
  })
})
