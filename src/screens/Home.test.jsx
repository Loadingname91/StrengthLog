import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

let mockState
vi.mock('../state/StoreContext', () => ({
  useStore: () => ({ state: mockState, dispatch: vi.fn(), exercises: [] }),
}))

function baseState(overrides = {}) {
  return {
    settings: { units: 'kg', theme: 'system', restDefault: 90, showRIR: true },
    user: { name: 'Athlete' },
    routines: [],
    routineOrder: [],
    sequenceIndex: 0,
    routineMode: 'sequence',
    weekdayAssignments: {},
    scheduleRestartAt: null,
    sessions: [],
    goals: [],
    activeWorkout: null,
    createdAt: '2026-01-01',
    ...overrides,
  }
}

function session(overrides = {}) {
  return {
    id: 's1',
    routineId: 'r1',
    routineName: 'Push Day',
    date: '2026-01-01',
    entries: [],
    volume: 500,
    prCount: 0,
    note: '',
    ...overrides,
  }
}

function renderHome(state) {
  mockState = state
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
}

describe('Home recent-workout card', () => {
  it('shows the most recent session\'s routine, date, and volume', () => {
    renderHome(baseState({
      sessions: [session({ id: 's1', date: '2026-01-01' }), session({ id: 's2', date: '2026-01-08', volume: 700 })],
    }))

    expect(screen.getByText('Recent workout')).toBeInTheDocument()
    expect(screen.getByText('Push Day')).toBeInTheDocument()
    expect(screen.getByText(/700kg/)).toBeInTheDocument()
    expect(screen.getByText('2 workouts logged · tap to see full history')).toBeInTheDocument()
  })

  it('clicking the card navigates to the full log', () => {
    renderHome(baseState({ sessions: [session()] }))

    fireEvent.click(screen.getByText('Recent workout'))
    expect(navigateMock).toHaveBeenCalledWith('/stats/log')
  })

  it('renders the empty-state instead of the card when there is no history', () => {
    renderHome(baseState({ sessions: [] }))

    expect(screen.queryByText('Recent workout')).not.toBeInTheDocument()
    expect(screen.getByText('Log your first workout')).toBeInTheDocument()
  })
})
