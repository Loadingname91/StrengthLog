import { heatColor } from '../lib/muscles'
import { localISODate, startOfWeek, fmtDate } from '../lib/format'

const WEEKDAY_LABELS = ['M', '', 'W', '', 'F', '', 'S']

// One column per week, one cell per day — the shape sparse "did I train
// today" data actually wants. A line chart of the same series is a flat run
// of zeros with occasional spikes, which reads as noise.
export default function CalendarHeatmap({ tallies, weeks = 12, onDayClick }) {
  const today = new Date()
  const todayISO = localISODate(today)
  const start = startOfWeek(today)
  start.setDate(start.getDate() - (weeks - 1) * 7)

  const maxVolume = Math.max(1, ...Object.values(tallies).map((t) => t.volume || 0))

  const columns = []
  for (let w = 0; w < weeks; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      const iso = localISODate(date)
      days.push({ iso, tally: tallies[iso], future: iso > todayISO, isToday: iso === todayISO })
    }
    columns.push(days)
  }

  function cellColor(day) {
    if (day.future) return 'transparent'
    if (!day.tally) return 'var(--surface-alt)'
    // Floor the intensity so a light (or bodyweight-only) session still reads
    // as trained rather than fading into an untrained day.
    return heatColor(Math.max(0.35, day.tally.volume / maxVolume))
  }

  return (
    <div>
      <div className="flex gap-[3px]">
        <div className="flex shrink-0 flex-col gap-[3px] pr-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={i} className="flex h-full min-h-[9px] flex-1 items-center text-[8px] leading-none" style={{ color: 'var(--muted)' }}>
              {label}
            </div>
          ))}
        </div>
        {columns.map((days, i) => (
          <div key={i} className="flex flex-1 flex-col gap-[3px]">
            {days.map((day) => (
              <div
                key={day.iso}
                onClick={day.tally && onDayClick ? () => onDayClick(day.iso) : undefined}
                title={day.tally ? `${fmtDate(day.iso)} — ${day.tally.count} workout${day.tally.count === 1 ? '' : 's'}` : fmtDate(day.iso)}
                className="aspect-square rounded-[3px]"
                style={{
                  background: cellColor(day),
                  cursor: day.tally && onDayClick ? 'pointer' : 'default',
                  outline: day.isToday ? '1.5px solid var(--accent)' : 'none',
                  outlineOffset: '1px',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
        <span>{weeks} weeks ago</span>
        <span className="flex items-center gap-1">
          Less
          {[0, 0.35, 0.6, 1].map((t) => (
            <span key={t} className="h-2 w-2 rounded-[2px]" style={{ background: t ? heatColor(t) : 'var(--surface-alt)' }} />
          ))}
          More
        </span>
        <span>Today</span>
      </div>
    </div>
  )
}
