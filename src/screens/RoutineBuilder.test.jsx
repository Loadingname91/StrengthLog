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

describe('BlockEditSheet sequence editor', () => {
  it('adding a set appends a set and a default-duration rest step', () => {
    const onSave = vi.fn()
    render(<BlockEditSheet block={sampleBlock()} restDefault={90} onCancel={vi.fn()} onSave={onSave} />)

    fireEvent.click(screen.getByText('+ Add Set'))
    fireEvent.click(screen.getByText('Save exercise'))

    const { sequence } = onSave.mock.calls[0][0]
    // sampleBlock has sets:3 -> backfilled to 5 steps (set,rest,set,rest,set);
    // adding one more appends {set},{rest} -> 7 steps, ending in a rest.
    expect(sequence).toHaveLength(7)
    expect(sequence.at(-2)).toEqual({ type: 'set' })
    expect(sequence.at(-1)).toEqual({ type: 'rest', seconds: 90 })
  })

  it('removing a rest row and re-adding it via the gap link round-trips to an equivalent sequence', () => {
    const onSave = vi.fn()
    render(<BlockEditSheet block={sampleBlock({ sets: 2 })} restDefault={90} onCancel={vi.fn()} onSave={onSave} />)

    // backfilled: [set, rest(90), set] — both sets show a remove control too
    // (2 sets total, so onlyOneStepLeft doesn't hide them); the rest row's
    // remove button is the middle one: [Set1 ×, Rest ×, Set2 ×].
    const removeButtons = screen.getAllByText('×')
    expect(removeButtons).toHaveLength(3)
    fireEvent.click(removeButtons[1]) // removes the rest row

    fireEvent.click(screen.getByText('+ Add rest'))
    fireEvent.click(screen.getByText('Save exercise'))

    const { sequence } = onSave.mock.calls[0][0]
    expect(sequence).toEqual([{ type: 'set' }, { type: 'rest', seconds: 90 }, { type: 'set' }])
  })

  it('cannot remove the last remaining set', () => {
    const onSave = vi.fn()
    render(<BlockEditSheet block={sampleBlock({ sets: 1 })} restDefault={90} onCancel={vi.fn()} onSave={onSave} />)

    // A single set, no rest steps — no remove control should be rendered.
    expect(screen.queryByText('×')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Save exercise'))
    expect(onSave.mock.calls[0][0].sequence).toEqual([{ type: 'set' }])
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
