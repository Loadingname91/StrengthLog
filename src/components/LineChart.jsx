import { useId } from 'react'

export default function LineChart({ series, height = 110, mode = 'line', formatLabel = (v) => v }) {
  const width = 320
  const gradientId = useId()
  const values = series.map((p) => p.value)
  const max = Math.max(1, ...values)

  if (!series.length || max === 0) {
    return (
      <div className="flex items-center justify-center text-xs" style={{ height, color: 'var(--muted)' }}>
        No data yet
      </div>
    )
  }

  // Compact sparklines (Measurements) skip the axis — there isn't room for
  // tick labels without crowding the line itself.
  const showAxis = height >= 90
  const padLeft = showAxis ? 26 : 2
  const padRight = 4
  const padTop = 8
  const padBottom = 4
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  // Dedupe: a small integer max (e.g. a "Workouts" count of 1) would
  // otherwise round the top and middle tick to the same label.
  const tickValues = [...new Set([max, Math.round(max / 2), 0])]
  const ticks = showAxis
    ? tickValues.map((v) => ({ y: padTop + (1 - v / max) * plotH, label: formatLabel(v) }))
    : []

  const gridlines = ticks.map((t, i) => (
    <g key={i}>
      <line x1={padLeft} x2={width - padRight} y1={t.y} y2={t.y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
      <text x={padLeft - 6} y={t.y + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{t.label}</text>
    </g>
  ))

  if (mode === 'bar') {
    const barW = plotW / series.length
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {gridlines}
        {series.map((p, i) => {
          const h = (p.value / max) * plotH
          return (
            <rect
              key={i}
              x={padLeft + i * barW + barW * 0.2}
              y={padTop + plotH - h}
              width={barW * 0.6}
              height={h}
              rx={3}
              fill="var(--accent)"
              opacity={p.value ? 1 : 0.25}
            />
          )
        })}
      </svg>
    )
  }

  const xAt = (i) => padLeft + (series.length <= 1 ? plotW / 2 : (i / (series.length - 1)) * plotW)
  const yAt = (v) => padTop + (1 - v / max) * plotH
  const linePoints = series.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(' ')
  const areaPoints = `${padLeft.toFixed(1)},${(padTop + plotH).toFixed(1)} ${linePoints} ${(padLeft + plotW).toFixed(1)},${(padTop + plotH).toFixed(1)}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridlines}
      <polygon points={areaPoints} fill={`url(#${gradientId})`} stroke="none" />
      <polyline points={linePoints} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {series.map((p, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(p.value)} r={p.value ? 2.5 : 0} fill="var(--accent)" />
      ))}
    </svg>
  )
}
