import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import BottomNav from './components/BottomNav'
import SessionBar from './components/SessionBar'
import { useStore } from './state/StoreContext'
import Home from './screens/Home'
import StatsHub from './screens/StatsHub'
import Routines from './screens/Routines'
import RoutineBuilder from './screens/RoutineBuilder'
import WorkoutOverview from './screens/WorkoutOverview'
import ActiveWorkout from './screens/ActiveWorkout'
import WorkoutSummary from './screens/WorkoutSummary'
import ExerciseDetail from './screens/ExerciseDetail'
import Measurements from './screens/Measurements'
import CsvImport from './screens/CsvImport'
import ExportInsights from './screens/ExportInsights'
import Settings from './screens/Settings'

function showNavFor(pathname) {
  if (pathname === '/' || pathname === '/routines' || pathname === '/settings') return true
  if (pathname === '/stats' || pathname.startsWith('/stats/')) return true
  return false
}

function useAndroidBackButton() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      const idx = window.history.state?.idx ?? 0
      if (idx > 0) {
        navigate(-1)
      } else if (location.pathname !== '/') {
        navigate('/')
      } else {
        CapacitorApp.exitApp()
      }
    })
    return () => { listenerPromise.then((listener) => listener.remove()) }
  }, [navigate, location.pathname])
}

function Shell() {
  const { pathname } = useLocation()
  const { state } = useStore()
  const withNav = showNavFor(pathname)
  const sessionActive = withNav && !!state.activeWorkout
  useAndroidBackButton()
  return (
    <div className="mx-auto min-h-screen max-w-[480px]" style={{ background: 'var(--bg)' }}>
      <div style={{ paddingBottom: sessionActive ? 140 : withNav ? 84 : 0 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stats" element={<StatsHub />} />
          <Route path="/stats/:tab" element={<StatsHub />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/routines/new" element={<RoutineBuilder />} />
          <Route path="/routines/:id/edit" element={<RoutineBuilder />} />
          <Route path="/routines/:id" element={<WorkoutOverview />} />
          <Route path="/workout" element={<ActiveWorkout />} />
          <Route path="/workout/summary" element={<WorkoutSummary />} />
          <Route path="/exercise/:id" element={<ExerciseDetail />} />
          <Route path="/measurements" element={<Measurements />} />
          <Route path="/csv-import" element={<CsvImport />} />
          <Route path="/export" element={<ExportInsights />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
      {withNav && <SessionBar />}
      {withNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
