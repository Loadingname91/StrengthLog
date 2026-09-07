import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StatsHub from './StatsHub'
import { fmtMonthYear } from '../lib/format'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ tab: 'log' }),
  }
})

let mockState
vi.mock('../state/StoreContext', () => ({
  useStore: () => ({ state: mockState, dispatch: vi.fn(), exercises: [] }),
}))

function session(overrides = {}) {
  return {
    id: 's1',
    routineId: 'r1',
    routineName: 'Push Day',
    date: '2026-01-01',
    entries: [],
    volume: 100,
    note: '',
    ...overrides,
  }
}

// Today is patched via a fixed system time so "current month" is deterministic.
function renderLog(sessions) {
  mockState = { sessions, routines: [{ id: 'r1', name: 'Push Day' }] }
  return render(
    <MemoryRouter>
      <StatsHub />
    </MemoryRouter>
  )
}

// The routine filter <select> also has a "Push Day" <option>, so text
// queries must exclude it to find the session row itself.
function sessionRowText(text) {
  return screen.queryAllByText(text).filter((el) => el.tagName !== 'OPTION')
}

describe('StatsHub LogTab month grouping', () => {
  it('expands the current month by default and shows its sessions', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 15)) // Feb 2026
    try {
      const sessions = [session({ id: 's1', date: '2026-02-10' })]
      renderLog(sessions)

      expect(screen.getByText(fmtMonthYear('2026-02-01'))).toBeInTheDocument()
      expect(sessionRowText('Push Day')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('collapses an older month until its header is clicked', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 15)) // Feb 2026
    try {
      const sessions = [session({ id: 's1', date: '2026-01-05' })]
      renderLog(sessions)

      expect(screen.getByText(fmtMonthYear('2026-01-01'))).toBeInTheDocument()
      expect(sessionRowText('Push Day')).toHaveLength(0)

      fireEvent.click(screen.getByText(fmtMonthYear('2026-01-01')))
      expect(sessionRowText('Push Day')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('clicking a session row navigates to its detail screen', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 15))
    try {
      renderLog([session({ id: 's1', date: '2026-02-10' })])

      fireEvent.click(sessionRowText('Push Day')[0])
      expect(navigateMock).toHaveBeenCalledWith('/session/s1')
    } finally {
      vi.useRealTimers()
    }
  })
})
