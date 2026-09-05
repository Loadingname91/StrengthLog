import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import Card from '../components/Card'
import ConfirmSheet from '../components/ConfirmSheet'
import LineChart from '../components/LineChart'
import { BackIcon, TrashIcon } from '../components/Icons'
import { fmtDate, todayISO, daysAgo, localISODate } from '../lib/format'

const METRICS = [
  { key: 'bodyweight', label: 'Bodyweight (kg)' },
  { key: 'waist', label: 'Waist (cm)' },
  { key: 'chest', label: 'Chest (cm)' },
  { key: 'biceps', label: 'Biceps (cm)' },
  { key: 'neck', label: 'Neck (cm)' },
]

export default function Measurements() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({ date: todayISO(), bodyweight: '', waist: '', chest: '', biceps: '', neck: '', notes: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)

  function submit() {
    const payload = { ...form }
    for (const m of METRICS) payload[m.key] = payload[m.key] === '' ? null : Number(payload[m.key])
    dispatch({ type: 'ADD_MEASUREMENT', payload })
    setForm({ date: todayISO(), bodyweight: '', waist: '', chest: '', biceps: '', neck: '', notes: '' })
  }

  const sorted = [...state.measurements].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const eightWeeksAgo = sorted.find((m) => m.date >= localISODate(daysAgo(56)))
  const waistDelta = latest && eightWeeksAgo && latest.waist != null && eightWeeksAgo.waist != null
    ? Math.round((latest.waist - eightWeeksAgo.waist) * 10) / 10
    : null

  return (
    <div className="pb-8">
      <div className="p-3.5"><button onClick={() => navigate(-1)} className="p-1.5"><BackIcon /></button></div>
      <div className="font-serif px-5 text-[22px] font-semibold">Measurements</div>

      {waistDelta != null && (
        <div className="mx-5 mt-3 rounded-2xl border p-3 text-[13px]" style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)', color: 'var(--accent-dark)' }}>
          Waist trend: {waistDelta <= 0 ? `${waistDelta}cm` : `+${waistDelta}cm`} over the last ~8 weeks.
        </div>
      )}

      <div className="px-5 pt-4">
        <Card>
          <div className="mb-2 text-sm font-semibold">Quick add</div>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mb-2 w-full rounded-lg border p-2 text-sm" style={{ borderColor: 'var(--border)' }} />
          <div className="grid grid-cols-2 gap-2">
            {METRICS.map((m) => (
              <input
                key={m.key}
                type="number"
                value={form[m.key]}
                onChange={(e) => setForm({ ...form, [m.key]: e.target.value })}
                placeholder={m.label}
                className="rounded-lg border p-2 text-sm"
                style={{ borderColor: 'var(--border)' }}
              />
            ))}
          </div>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes"
            className="mt-2 w-full rounded-lg border p-2 text-sm"
            style={{ borderColor: 'var(--border)' }}
          />
          <button onClick={submit} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Save</button>
        </Card>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-5">
        {METRICS.map((m) => {
          const series = sorted.filter((s) => s[m.key] != null).map((s) => ({ date: s.date, value: s[m.key] }))
          return (
            <div key={m.key}>
              <div className="mb-1.5 text-[13px] font-semibold">{m.label}</div>
              <Card><LineChart series={series} height={70} /></Card>
            </div>
          )
        })}
      </div>

      <div className="px-5 pt-5">
        <div className="mb-2 text-[13px] font-semibold">Entries</div>
        <div className="flex flex-col gap-1.5">
          {[...sorted].reverse().map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl border p-2.5 text-xs" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>{fmtDate(entry.date)}</span>
              <span className="tabular-nums">
                {METRICS.filter((m) => entry[m.key] != null).map((m) => `${m.label.split(' ')[0]} ${entry[m.key]}`).join(' · ')}
              </span>
              <button onClick={() => setDeleteTarget(entry.id)} style={{ color: 'var(--muted)' }}>
                <TrashIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmSheet
        open={!!deleteTarget}
        title="Delete this entry?"
        body="This measurement entry will be permanently removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { dispatch({ type: 'DELETE_MEASUREMENT', payload: deleteTarget }); setDeleteTarget(null) }}
      />
    </div>
  )
}
