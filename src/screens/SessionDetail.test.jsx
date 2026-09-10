import { describe, it, expect, vi } from 'vitest'
import { useSyncExternalStore } from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { reducer } from '../state/reducer'
import SessionDetail from './SessionDetail'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: testSessionId }),
  }
})

const showToastMock = vi.fn()
vi.mock('../state/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

// Same bridging pattern as ActiveWorkout.test.jsx — a minimal external store
// so dispatching from inside SessionDetail re-renders it like the real
// StoreProvider does.
function createTestStore(initialState) {
  let state = initialState
  const listeners = new Set()
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispatch: (action) => {
      state = reducer(state, action)
      listeners.forEach((l) => l())
    },
  }
}

let testStore
let testSessionId = 's1'

vi.mock('../state/StoreContext', () => ({
  useStore: () => {
    const state = useSyncExternalStore(testStore.subscribe, testStore.getState)
    return { state, dispatch: testStore.dispatch, exercises: [] }
  },
}))

function baseState(overrides = {}) {
  return {
    settings: { units: 'kg', theme: 'system', restDefault: 90, showRIR: true },
    user: { name: 'Athlete' },
    customExercises: [],
    exerciseNotes: {},
    importPresets: [],
    lastFinishedSession: null,
    routines: [],
    routineOrder: [],
    sequenceIndex: 0,
    routineMode: 'sequence',
    weekdayAssignments: {},
    scheduleRestartAt: null,
    sessions: [],
    measurements: [],
    goals: [],
    activeWorkout: null,
    lastImportedAt: null,
    createdAt: '2026-01-01',
    ...overrides,
  }
}

function sampleSession(overrides = {}) {
  return {
    id: 's1',
    routineId: 'r1',
    routineName: 'Push Day',
    date: '2026-01-01',
    startedAt: '2026-01-01T10:00:00.000Z',
    finishedAt: '2026-01-01T10:30:00.000Z',
    durationSec: 1800,
    note: '',
    entries: [{ exerciseId: 'bench-press', blockId: 'block1', sets: [{ weight: 60, reps: 10, rir: 2, isPR: true }] }],
    volume: 600,
    prCount: 1,
    ...overrides,
  }
}

function sampleRoutine(id = 'r1') {
  return { id, name: 'Push Day', position: 'Session 1 of 1', blocks: [] }
}

function renderDetail(session = sampleSession(), state = {}) {
  testSessionId = session.id
  testStore = createTestStore(baseState({ sessions: [session], routines: [sampleRoutine()], ...state }))
  return render(
    <MemoryRouter>
      <SessionDetail />
    </MemoryRouter>
  )
}

describe('SessionDetail', () => {
  it('renders duration, volume, PR count, and per-set weight/reps', () => {
    renderDetail()

    expect(screen.getByText('Push Day')).toBeInTheDocument()
    expect(screen.getByText('600')).toBeInTheDocument() // volume
    expect(screen.getByText('60kg × 10')).toBeInTheDocument()
    expect(screen.getByTitle('PR')).toBeInTheDocument()
  })

  it('renders a duration-only set as "Ns" instead of "0kg × 0"', () => {
    renderDetail(sampleSession({
      entries: [{ exerciseId: 'plank', blockId: 'block1', sets: [{ weight: 0, reps: 0, rir: null, isPR: false, durationSec: 45 }] }],
    }))

    expect(screen.getByText('45s')).toBeInTheDocument()
    expect(screen.queryByText('0kg × 0')).not.toBeInTheDocument()
  })

  it('renders a logged weight/reps set with a durationSec alongside it', () => {
    renderDetail(sampleSession({
      entries: [{ exerciseId: 'bench-press', blockId: 'block1', sets: [{ weight: 60, reps: 10, rir: 2, isPR: false, durationSec: 12 }] }],
    }))

    expect(screen.getByText('60kg × 10 · 12s')).toBeInTheDocument()
  })

  it('redirects to the log when the session id is unknown', () => {
    testSessionId = 'does-not-exist'
    testStore = createTestStore(baseState({ sessions: [sampleSession()] }))
    render(
      <MemoryRouter>
        <SessionDetail />
      </MemoryRouter>
    )

    expect(navigateMock).toHaveBeenCalledWith('/stats/log', { replace: true })
  })

  it('deleting the session dispatches DELETE_SESSION and navigates back to the log', () => {
    renderDetail()

    fireEvent.click(screen.getByText('⋮'))
    fireEvent.click(screen.getByText('Delete workout'))
    fireEvent.click(screen.getByText('Delete'))

    expect(testStore.getState().sessions).toHaveLength(0)
    expect(showToastMock).toHaveBeenCalledWith('Workout deleted')
    expect(navigateMock).toHaveBeenCalledWith('/stats/log', { replace: true })
  })

  it('Repeat workout is disabled when the routine no longer exists', () => {
    renderDetail(sampleSession(), { routines: [] })

    fireEvent.click(screen.getByText('⋮'))
    expect(screen.getByText('Repeat workout')).toBeDisabled()
  })

  it('Repeat workout starts a new workout for the session\'s routine', () => {
    renderDetail()

    fireEvent.click(screen.getByText('⋮'))
    fireEvent.click(screen.getByText('Repeat workout'))

    expect(testStore.getState().activeWorkout).not.toBeNull()
    expect(testStore.getState().activeWorkout.routineId).toBe('r1')
    expect(navigateMock).toHaveBeenCalledWith('/workout')
  })
})
