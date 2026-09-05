import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { BlockEditSheet } from './RoutineBuilder'

function sampleBlock(overrides = {}) {
  return {
    id: 'b1',
    exerciseIds: ['bench-press'],
    sets: 3,
    repMin: 8,
    repMax: 12,
    rest: 90,
    rir: 2,
    targetWeight: null,
    ...overrides,
  }
}

describe('BlockEditSheet target-weight field', () => {
  it('saves a numeric targetWeight when a value is typed', () => {
    const onSave = vi.fn()
    render(<BlockEditSheet block={sampleBlock()} onCancel={vi.fn()} onSave={onSave} />)

    const input = screen.getByPlaceholderText('e.g. 60')
    fireEvent.change(input, { target: { value: '60' } })
    fireEvent.click(screen.getByText('Save exercise'))

    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.targetWeight).toBe(60)
  })

  it('saves null targetWeight when left blank', () => {
    const onSave = vi.fn()
    render(<BlockEditSheet block={sampleBlock()} onCancel={vi.fn()} onSave={onSave} />)

    fireEvent.click(screen.getByText('Save exercise'))

    const payload = onSave.mock.calls[0][0]
    expect(payload.targetWeight).toBeNull()
  })
})
