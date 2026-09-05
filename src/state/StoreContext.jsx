import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { reducer, initialSettings, allExercises } from './reducer'
import { loadState, saveState } from './storage'
import { todayISO } from '../lib/format'
import { defaultWeekdayAssignments } from '../lib/schedule'
import { useWorkoutNotifications } from './useWorkoutNotifications'

const StoreCtx = createContext(null)

export function buildInitialState() {
  const persisted = loadState()
  if (persisted) {
    // Backfill fields added after this state was first saved.
    if (!persisted.weekdayAssignments) persisted.weekdayAssignments = defaultWeekdayAssignments(persisted.routineOrder)
    if (persisted.scheduleRestartAt === undefined) persisted.scheduleRestartAt = null
    // Defaults first, persisted second — so any settings key added after a
    // user's first save (e.g. notification prefs) reads as its default
    // instead of undefined, without a one-off backfill line per key.
    persisted.settings = { ...initialSettings(), ...persisted.settings }
    return persisted
  }
  return {
    settings: initialSettings(),
    user: { name: 'Athlete' },
    customExercises: [],
    exerciseNotes: {},
    importPresets: [],
    lastFinishedSession: null,
    routines: [],
    routineOrder: [],
    sequenceIndex: 0,
    routineMode: 'sequence',
    weekdayAssignments: defaultWeekdayAssignments([]),
    scheduleRestartAt: null,
    sessions: [],
    measurements: [],
    goals: [],
    activeWorkout: null,
    lastImportedAt: null,
    createdAt: todayISO(),
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const exercises = useMemo(() => allExercises(state), [state])
  useWorkoutNotifications(state, exercises)

  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const mode = state.settings.theme
      const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [state.settings.theme])

  const value = useMemo(() => ({ state, dispatch, exercises }), [state, exercises])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
