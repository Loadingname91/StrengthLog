import { toPolyline } from '../lib/selectors'

export default function Sparkline({ series, width = 56, height = 26, color = 'var(--accent)' }) {
  if (!series.length) return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} />
  const points = toPolyline(series, width, height, 2)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
