export default function ProgressBar({ pct, height = 8, color = 'var(--accent)', track = 'var(--surface-alt)' }) {
  return (
    <div className="overflow-hidden rounded-full" style={{ height, background: track }}>
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  )
}
