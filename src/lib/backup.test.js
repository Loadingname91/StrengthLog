import { describe, it, expect } from 'vitest'
import { buildBackupFilename, isValidBackup, parseBackup } from './backup'

describe('buildBackupFilename', () => {
  it('formats a fixed date as strengthlog-backup-YYYY-MM-DD.json', () => {
    expect(buildBackupFilename(new Date('2026-02-14T10:00:00.000Z'))).toBe('strengthlog-backup-2026-02-14.json')
  })
})

describe('isValidBackup', () => {
  it('accepts an object with sessions and routines arrays', () => {
    expect(isValidBackup({ sessions: [], routines: [] })).toBe(true)
  })

  it('rejects null, arrays, and primitives', () => {
    expect(isValidBackup(null)).toBe(false)
    expect(isValidBackup([1, 2, 3])).toBe(false)
    expect(isValidBackup('hello')).toBe(false)
    expect(isValidBackup(42)).toBe(false)
  })

  it('rejects an object missing sessions or routines', () => {
    expect(isValidBackup({})).toBe(false)
    expect(isValidBackup({ sessions: [] })).toBe(false)
    expect(isValidBackup({ routines: [] })).toBe(false)
  })

  it('rejects wrong-typed sessions/routines', () => {
    expect(isValidBackup({ sessions: 'x', routines: [] })).toBe(false)
    expect(isValidBackup({ sessions: [], routines: {} })).toBe(false)
  })
})

describe('parseBackup', () => {
  it('returns ok:true with parsed data for valid backup JSON', () => {
    const result = parseBackup(JSON.stringify({ sessions: [{ id: 's1' }], routines: [] }))
    expect(result.ok).toBe(true)
    expect(result.data.sessions).toHaveLength(1)
  })

  it('returns ok:false, error invalid-json for malformed text', () => {
    expect(parseBackup('{not json')).toEqual({ ok: false, error: 'invalid-json' })
  })

  it('returns ok:false, error invalid-shape for well-formed but wrong-shaped JSON', () => {
    expect(parseBackup('{"foo":1}')).toEqual({ ok: false, error: 'invalid-shape' })
    expect(parseBackup('[1,2,3]')).toEqual({ ok: false, error: 'invalid-shape' })
  })
})
