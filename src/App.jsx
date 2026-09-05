import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
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

function Shell() {
  const { pathname } = useLocation()
  const withNav = showNavFor(pathname)
  return (
    <div className="mx-auto min-h-screen max-w-[480px]" style={{ background: 'var(--bg)' }}>
      <div style={{ paddingBottom: withNav ? 84 : 0 }}>
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
