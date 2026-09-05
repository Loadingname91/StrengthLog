import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { BlockEditSheet } from './RoutineBuilder'
import RoutineBuilder from './RoutineBuilder'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'r1' }),
}))

vi.mock('../state/StoreContext', () => ({
  useStore: () => ({
    state: {
      routines: [
        {
          id: 'r1',
          name: 'Push Day',
          position: 'Session 1 of 1',
          blocks: [
            { id: 'b1', type: 'single', exerciseIds: ['bench-press'], sets: 3, repMin: 8, repMax: 12, rest: 90, rir: 2, targetWeight: null },
          ],
        },
      ],
    },
    dispatch: vi.fn(),
  }),
}))

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

describe('RoutineBuilder drag gesture', () => {
  it('aborts an in-progress drag when the window loses focus (backgrounding)', () => {
    render(<RoutineBuilder />)

    const grip = screen.getByLabelText('Drag to reorder')
    fireEvent.pointerDown(grip, { pointerId: 1, clientY: 100 })

    const row = grip.closest('div')
    expect(row.style.transform).toContain('scale(1.02)')

    fireEvent(window, new Event('blur'))

    expect(row.style.transform).toBe('')
  })
})
