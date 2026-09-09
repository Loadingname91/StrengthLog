import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Settings from './Settings'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const showToastMock = vi.fn()
vi.mock('../state/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

const dispatchMock = vi.fn()
let mockState
vi.mock('../state/StoreContext', () => ({
  useStore: () => ({ state: mockState, dispatch: dispatchMock, exercises: [] }),
}))

const saveStateMock = vi.fn()
vi.mock('../state/storage', () => ({
  saveState: (...args) => saveStateMock(...args),
}))

const downloadTextFileMock = vi.fn()
vi.mock('../lib/csv', () => ({
  downloadTextFile: (...args) => downloadTextFileMock(...args),
}))

vi.mock('@capacitor/app', () => ({
  App: { addListener: () => Promise.resolve({ remove: () => {} }) },
}))

vi.mock('../lib/nativeNotifications', () => ({
  checkNotificationPermission: () => Promise.resolve('granted'),
  requestNotificationPermission: () => Promise.resolve('granted'),
  checkExactAlarmPermission: () => Promise.resolve('granted'),
  openExactAlarmSettings: () => Promise.resolve('granted'),
}))

function baseState(overrides = {}) {
  return {
    settings: { units: 'kg', theme: 'system', restDefault: 90, showRIR: true },
    user: { name: 'Athlete' },
    routines: [],
    sessions: [],
    goals: [],
    ...overrides,
  }
}

function renderSettings(state = baseState()) {
  mockState = state
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  )
}

function jsonFile(content, name = 'backup.json') {
  return new File([content], name, { type: 'application/json' })
}

beforeEach(() => {
  navigateMock.mockClear()
  showToastMock.mockClear()
  dispatchMock.mockClear()
  saveStateMock.mockClear()
  downloadTextFileMock.mockClear()
  downloadTextFileMock.mockResolvedValue(undefined)
})

describe('Settings backup', () => {
  it('downloads a JSON backup named after today and shows a success toast', async () => {
    const state = baseState({ sessions: [{ id: 's1' }] })
    renderSettings(state)

    await act(async () => {
      fireEvent.click(screen.getByText('Back up data'))
    })

    expect(downloadTextFileMock).toHaveBeenCalledTimes(1)
    const [filename, mime, content] = downloadTextFileMock.mock.calls[0]
    expect(filename).toMatch(/^strengthlog-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect(mime).toBe('application/json')
    expect(JSON.parse(content)).toEqual(state)
    expect(showToastMock).toHaveBeenCalledWith('Backup downloaded')
  })

  it('shows an error toast when the backup download fails', async () => {
    downloadTextFileMock.mockRejectedValue(new Error('nope'))
    renderSettings()

    await act(async () => {
      fireEvent.click(screen.getByText('Back up data'))
    })

    expect(showToastMock).toHaveBeenCalledWith('Could not create backup')
  })
})

describe('Settings restore', () => {
  it('opens the confirm sheet after picking a valid backup file', async () => {
    renderSettings()
    const input = document.querySelector('input[type="file"]')

    fireEvent.change(input, { target: { files: [jsonFile(JSON.stringify({ sessions: [], routines: [] }))] } })

    await vi.waitFor(() => expect(screen.getByText('Restore backup?')).toBeInTheDocument())
  })

  it('rejects an invalid backup file with a toast and no confirm sheet', async () => {
    renderSettings()
    const input = document.querySelector('input[type="file"]')

    fireEvent.change(input, { target: { files: [jsonFile('{"not":"a backup"}')] } })

    await vi.waitFor(() => expect(showToastMock).toHaveBeenCalledWith("That file isn't a valid backup"))
    expect(screen.queryByText('Restore backup?')).not.toBeInTheDocument()
  })

  it('confirming (hold) writes the parsed backup and reloads', async () => {
    vi.useFakeTimers()
    const reloadMock = vi.fn()
    const originalLocation = window.location
    delete window.location
    window.location = { ...originalLocation, reload: reloadMock }

    try {
      renderSettings()
      const input = document.querySelector('input[type="file"]')
      const backup = { sessions: [{ id: 'restored' }], routines: [] }

      fireEvent.change(input, { target: { files: [jsonFile(JSON.stringify(backup))] } })
      await vi.waitFor(() => expect(screen.getByText('Restore backup?')).toBeInTheDocument())

      fireEvent.pointerDown(screen.getByText('Restore'))
      act(() => { vi.advanceTimersByTime(1500) })

      expect(saveStateMock).toHaveBeenCalledWith(backup)
      expect(reloadMock).toHaveBeenCalledTimes(1)
    } finally {
      window.location = originalLocation
      vi.useRealTimers()
    }
  })

  it('cancelling leaves data untouched', async () => {
    renderSettings()
    const input = document.querySelector('input[type="file"]')

    fireEvent.change(input, { target: { files: [jsonFile(JSON.stringify({ sessions: [], routines: [] }))] } })
    await vi.waitFor(() => expect(screen.getByText('Restore backup?')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText('Restore backup?')).not.toBeInTheDocument()
    expect(saveStateMock).not.toHaveBeenCalled()
  })
})
