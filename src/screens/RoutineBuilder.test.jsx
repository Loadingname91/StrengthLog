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
            { id: 'b2', type: 'single', exerciseIds: ['barbell-row'], sets: 3, repMin: 8, repMax: 12, rest: 90, rir: 2, targetWeight: null },
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
  it('adding a set appends only a set, no auto-added rest', () => {
    const onSave = vi.fn()
    render(<BlockEditSheet block={sampleBlock()} restDefault={90} onCancel={vi.fn()} onSave={onSave} />)

    fireEvent.click(screen.getByText('+ Add Set'))
    fireEvent.click(screen.getByText('Save exercise'))

    const { sequence } = onSave.mock.calls[0][0]
    // sampleBlock has sets:3 -> backfilled to 5 steps (set,rest,set,rest,set);
    // adding one more appends just {set} -> 6 steps, ending in a set.
    expect(sequence).toHaveLength(6)
    expect(sequence.at(-1)).toEqual({ type: 'set' })
  })

  it('"+ Add rest" is available on the final step and appends a trailing rest', () => {
    const onSave = vi.fn()
    render(<BlockEditSheet block={sampleBlock({ sets: 1 })} restDefault={90} onCancel={vi.fn()} onSave={onSave} />)

    // backfilled: [set] — a single step, so its "+ Add rest" link is the only one.
    fireEvent.click(screen.getByText('+ Add rest'))
    fireEvent.click(screen.getByText('Save exercise'))

    const { sequence } = onSave.mock.calls[0][0]
    expect(sequence).toEqual([{ type: 'set' }, { type: 'rest', seconds: 90 }])
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

    // Both remaining set steps now show their own "+ Add rest" link (the
    // last step's is no longer hidden) — click the first, matching this
    // test's original intent of re-adding rest between set 1 and set 2.
    fireEvent.click(screen.getAllByText('+ Add rest')[0])
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

    const grip = screen.getAllByLabelText('Drag to reorder')[0]
    fireEvent.pointerDown(grip, { pointerId: 1, clientY: 100 })

    const row = grip.closest('div')
    expect(row.style.transform).toContain('scale(1.02)')

    fireEvent(window, new Event('blur'))

    expect(row.style.transform).toBe('')
  })

  it('swaps past a taller row using that row\'s own measured height, not the dragged row\'s', () => {
    render(<RoutineBuilder />)
    const grips = screen.getAllByLabelText('Drag to reorder')
    const rows = grips.map((g) => g.closest('div'))

    // Row 0 ("b1") is short (40px); row 1 ("b2") is tall (80px). Dragging b1
    // down should only swap once the pointer clears half of b2's own
    // height (40px) — with the old fixed-height formula (which used the
    // dragged row's own 40px for every comparison), a 41px move would have
    // wrongly triggered the swap already at its own half-height (20px).
    vi.spyOn(rows[0], 'getBoundingClientRect').mockReturnValue({ top: 0, height: 40 })
    vi.spyOn(rows[1], 'getBoundingClientRect').mockReturnValue({ top: 48, height: 80 })

    fireEvent.pointerDown(grips[0], { pointerId: 1, clientY: 0 })

    // 30px clears b1's own half-height (20) but not half of b2's real
    // height (40) — must NOT have swapped yet.
    fireEvent.pointerMove(grips[0], { pointerId: 1, clientY: 30 })
    expect(screen.getAllByLabelText('Drag to reorder')[0]).toBe(grips[0])

    // 45px clears half of b2's real 80px height — now it should swap.
    fireEvent.pointerMove(grips[0], { pointerId: 1, clientY: 45 })
    const namesAfter = screen.getAllByText(/Bench Press|Barbell Row/).map((el) => el.textContent)
    expect(namesAfter[0]).toBe('Barbell Row')
    expect(namesAfter[1]).toBe('Bench Press')
  })
})

describe('BlockEditSheet superset editing', () => {
  it('renders exercise tabs and allows editing individual exercise parameters', () => {
    const onSave = vi.fn()
    const supersetBlock = {
      id: 'b-super',
      type: 'superset',
      exerciseIds: ['bench-press', 'barbell-row'],
      exercises: [
        { exerciseId: 'bench-press', repMin: 8, repMax: 12, sets: 3, rest: 90, rir: 2, targetWeight: 80 },
        { exerciseId: 'barbell-row', repMin: 10, repMax: 15, sets: 2, rest: 60, rir: null, targetWeight: 50 },
      ],
    }

    render(
      <BlockEditSheet
        block={supersetBlock}
        restDefault={90}
        onCancel={vi.fn()}
        onSave={onSave}
        exercises={[
          { id: 'bench-press', name: 'Bench Press' },
          { id: 'barbell-row', name: 'Barbell Row' },
        ]}
      />
    )

    // Tabs: "Bench Press (3 sets)" and "Barbell Row (2 sets)".
    // Use getAllByRole to guard against any stale DOM from prior tests, then
    // pick the last (most recently rendered) matching button.
    const benchButtons = screen.getAllByRole('button', { name: /Bench Press/ })
    const benchTab = benchButtons[benchButtons.length - 1]
    expect(benchTab).toBeInTheDocument()
    const rowButtons = screen.getAllByRole('button', { name: /Barbell Row/ })
    const rowTab = rowButtons[rowButtons.length - 1]
    expect(rowTab).toBeInTheDocument()

    fireEvent.click(rowTab)

    const weightInput = screen.getByPlaceholderText('e.g. 60')
    expect(weightInput.value).toBe('50')
    fireEvent.change(weightInput, { target: { value: '55' } })

    fireEvent.click(screen.getByText('Save superset'))

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0]
    expect(saved.type).toBe('superset')
    expect(saved.exercises[0].exerciseId).toBe('bench-press')
    expect(saved.exercises[0].targetWeight).toBe(80)
    expect(saved.exercises[1].exerciseId).toBe('barbell-row')
    expect(saved.exercises[1].targetWeight).toBe(55)
  })
})

