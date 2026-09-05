import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SessionBar from './SessionBar'

const mockUseStoreReturn = { state: { activeWorkout: null } }

vi.mock('../state/StoreContext', () => ({
  useStore: () => mockUseStoreReturn,
}))

describe('SessionBar', () => {
  it('renders nothing when there is no active workout', () => {
    mockUseStoreReturn.state.activeWorkout = null
    const { container } = render(
      <MemoryRouter>
        <SessionBar />
      </MemoryRouter>
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders the routine name when a workout is active', () => {
    mockUseStoreReturn.state.activeWorkout = { routineName: 'Push Day', startedAt: new Date().toISOString() }
    render(
      <MemoryRouter>
        <SessionBar />
      </MemoryRouter>
    )

    expect(screen.getByText(/Push Day/)).toBeInTheDocument()
  })
})
