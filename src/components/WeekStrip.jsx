import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { weekStripDates, dayStatus, weekdayName } from '../lib/schedule'
import { todayISO } from '../lib/format'

const STATE_STYLE = {
  done: { dot: 'var(--accent)', numberColor: '#fff', ring: 'transparent', labelColor: 'var(--accent-dark)' },
  missed: { dot: 'transparent', numberColor: 'var(--danger)', ring: 'var(--danger)', labelColor: 'var(--danger)' },
  today: { dot: 'transparent', numberColor: 'var(--accent-dark)', ring: 'var(--accent)', labelColor: 'var(--accent-dark)' },
  future: { dot: 'transparent', numberColor: 'var(--text)', ring: 'transparent', labelColor: 'var(--muted)' },
  rest: { dot: 'transparent', numberColor: 'var(--muted)', ring: 'transparent', labelColor: 'var(--muted)' },
}

export default function WeekStrip({ weekdayAssignments, sessions, routines }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const navigate = useNavigate()
  const today = todayISO()
  const dates = weekStripDates(weekOffset)

  const routineShort = (id) => {
    const r = routines.find((x) => x.id === id)
    return r ? r.name.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase() : ''
  }

  return (
    <div className="rounded-[18px] border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setWeekOffset((w) => w - 1)} className="px-2 text-sm font-semibold" style={{ color: 'var(--muted)' }}>◀</button>
        <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          {weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : weekOffset === 1 ? 'Next week' : `${weekOffset > 0 ? '+' : ''}${weekOffset} weeks`}
        </span>
        <button onClick={() => setWeekOffset((w) => w + 1)} className="px-2 text-sm font-semibold" style={{ color: 'var(--muted)' }}>▶</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const { routineId, state } = dayStatus(date, weekdayAssignments, sessions, today)
          const style = STATE_STYLE[state]
          const dayNum = Number(date.slice(8, 10))
          const weekday = new Date(date + 'T00:00:00').getDay()
          return (
            <button
              key={date}
              disabled={!routineId}
              onClick={() => routineId && navigate(`/routines/${routineId}`)}
              className="flex flex-col items-center gap-1 rounded-xl py-2"
              style={{ background: date === today ? 'var(--accent-light)' : 'transparent' }}
            >
              <span className="text-[10px] font-semibold" style={{ color: 'var(--muted)' }}>{weekdayName(weekday, true)[0]}</span>
              <span
                className="tabular-nums flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold"
                style={{ borderColor: style.ring, color: style.numberColor, background: style.dot }}
              >
                {dayNum}
              </span>
              <span className="text-[9px] font-semibold" style={{ color: style.labelColor, opacity: state === 'future' ? 0.7 : 1 }}>
                {routineId ? routineShort(routineId) : '—'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
