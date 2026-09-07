import { weekdayName } from '../lib/schedule'

// Mon-first display order; values stay 0=Sun..6=Sat (the app convention
// everywhere else) — only the display order is Monday-first, like WeekStrip.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default function WeekdayPicker({ value, onChange, disabled = false }) {
  function toggle(day) {
    if (disabled) return
    const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day]
    onChange(next.sort((a, b) => a - b))
  }

  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAY_ORDER.map((day) => {
        const active = value.includes(day)
        return (
          <button
            key={day}
            type="button"
            disabled={disabled}
            onClick={() => toggle(day)}
            className="rounded-lg py-1.5 text-[11px] font-semibold"
            style={{
              background: active ? 'var(--accent)' : 'var(--surface-alt)',
              color: active ? '#fff' : 'var(--muted)',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {weekdayName(day, true)[0]}
          </button>
        )
      })}
    </div>
  )
}
