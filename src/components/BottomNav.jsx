import { NavLink, useNavigate } from 'react-router-dom'
import { HomeIcon, StatsIcon, LogIcon, RoutinesIcon, SettingsIcon } from './Icons'
import { useStore } from '../state/StoreContext'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/stats', label: 'Stats', Icon: StatsIcon },
  { to: '/log', label: 'Log', Icon: LogIcon, elevated: true },
  { to: '/routines', label: 'Routines', Icon: RoutinesIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export default function BottomNav() {
  const { state } = useStore()
  const navigate = useNavigate()

  function handleLog(e) {
    e.preventDefault()
    if (state.activeWorkout) {
      navigate('/workout')
      return
    }
    const nextId = state.routineOrder[state.sequenceIndex] || state.routineOrder[0]
    if (nextId) navigate(`/routines/${nextId}`)
    else navigate('/routines')
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 mx-auto flex max-w-[480px] items-end justify-between border-t px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {TABS.map(({ to, label, Icon, elevated }) =>
        elevated ? (
          <button
            key={to}
            onClick={handleLog}
            className="flex flex-1 flex-col items-center gap-1 pb-1"
          >
            <span
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
              style={{ background: 'var(--accent)' }}
            >
              <Icon size={26} />
            </span>
            <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>{label}</span>
          </button>
        ) : (
          <NavLink
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center gap-1 py-1"
            style={({ isActive }) => ({ color: isActive ? 'var(--accent)' : 'var(--muted)' })}
          >
            <Icon size={22} />
            <span className="text-[11px] font-medium">{label}</span>
          </NavLink>
        )
      )}
    </nav>
  )
}
