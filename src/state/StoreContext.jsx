import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { reducer, initialSettings, allExercises } from './reducer'
import { loadState, saveState } from './storage'
import { buildSeed } from '../lib/seed'

const StoreCtx = createContext(null)

function buildInitialState() {
  const persisted = loadState()
  if (persisted) return persisted
  return {
    settings: initialSettings(),
    user: { name: 'Marcus' },
    customExercises: [],
    exerciseNotes: {},
    importPresets: [],
    lastFinishedSession: null,
    ...buildSeed(),
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState)

  useEffect(() => {
    saveState(state)
  }, [state])

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

  const value = useMemo(() => ({ state, dispatch, exercises: allExercises(state) }), [state])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
