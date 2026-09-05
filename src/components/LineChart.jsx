import { toPolyline } from '../lib/selectors'

export default function LineChart({ series, height = 110, mode = 'line', formatLabel }) {
  const width = 320
  const values = series.map((p) => p.value)
  const max = Math.max(1, ...values)

  if (!series.length || max === 0) {
    return (
      <div className="flex items-center justify-center text-xs" style={{ height, color: 'var(--muted)' }}>
        No data yet
      </div>
    )
  }

  if (mode === 'bar') {
    const barW = width / series.length
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {series.map((p, i) => {
          const h = (p.value / max) * (height - 8)
          return (
            <rect
              key={i}
              x={i * barW + barW * 0.2}
              y={height - h}
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

  const points = toPolyline(series, width, height)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
