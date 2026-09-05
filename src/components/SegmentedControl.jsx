export default function SegmentedControl({ options, value, onChange, size = 'sm' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-sm'
  return (
    <div className="inline-flex rounded-[10px] p-0.5" style={{ background: 'var(--surface-alt)' }}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg font-semibold ${pad}`}
            style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--muted)' }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
