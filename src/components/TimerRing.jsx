import { fmtElapsed } from '../lib/format'

export default function TimerRing({ remaining, total, size = 56 }) {
  const radius = size / 2 - 4
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const ringOffset = total > 0 ? circumference * (1 - remaining / total) : 0

  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--surface-alt)" strokeWidth="5" />
        <circle
          cx={center} cy={center} r={radius} fill="none" stroke="var(--accent)" strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={ringOffset}
          transform={`rotate(-90 ${center} ${center})`} strokeLinecap="round"
        />
      </svg>
      <div className="tabular-nums absolute inset-0 flex items-center justify-center text-[13px] font-bold">{fmtElapsed(remaining)}</div>
    </div>
  )
}
