import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import { useToast } from '../state/ToastContext'
import { BackIcon } from '../components/Icons'
import { buildInsights } from '../lib/insights'
import { toCSV, downloadTextFile } from '../lib/csv'
import { exerciseById } from '../lib/exercises'
import { sessionsInRange } from '../lib/selectors'
import { todayISO } from '../lib/format'

export default function ExportInsights() {
  const { state, exercises } = useStore()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(todayISO())

  const inRange = useMemo(() => {
    if (!from) return state.sessions
    return sessionsInRange(state.sessions, new Date(from), new Date(to || todayISO()))
  }, [state.sessions, from, to])

  const insights = useMemo(() => buildInsights(inRange, exercises), [inRange, exercises])
  const hasData = inRange.length > 0

  function exportCSV() {
    const headers = ['Date', 'Routine', 'Exercise', 'Set #', 'Weight', 'Reps', 'RIR']
    const rows = []
    for (const s of inRange) {
      for (const entry of s.entries) {
        entry.sets.forEach((set, i) => {
          rows.push([s.date, s.routineName, exerciseById(entry.exerciseId, exercises)?.name || entry.exerciseId, i + 1, set.weight, set.reps, set.rir ?? ''])
        })
      }
    }
    downloadTextFile('fitlog-export.csv', 'text/csv', toCSV(headers, rows))
    showToast('CSV downloaded')
  }

  function exportPDF() {
    window.print()
  }

  return (
    <div className="pb-8">
      <div className="p-3.5"><button onClick={() => navigate('/settings')} className="p-1.5"><BackIcon /></button></div>
      <div className="font-serif px-5 text-[22px] font-semibold">Export & Insights</div>

      <div className="flex gap-2 px-5 pt-3.5">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="flex-1 rounded-lg border p-2 text-xs" style={{ borderColor: 'var(--border)' }} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="flex-1 rounded-lg border p-2 text-xs" style={{ borderColor: 'var(--border)' }} />
      </div>
      {!from && <div className="px-5 pt-1 text-[11px]" style={{ color: 'var(--muted)' }}>No start date set — exporting all time.</div>}

      <div className="flex gap-2.5 px-5 pt-3.5">
        <button
          disabled={!hasData}
          onClick={exportCSV}
          className="flex-1 rounded-xl border py-3 text-[13px] font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--accent)', background: 'var(--accent-light)', color: 'var(--accent-dark)' }}
        >
          Export CSV
        </button>
        <button
          disabled={!hasData}
          onClick={exportPDF}
          className="flex-1 rounded-xl border py-3 text-[13px] font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--border)' }}
        >
          Export PDF
        </button>
      </div>
      {!hasData && <div className="px-5 pt-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>No workouts in this range yet.</div>}

      <div className="px-5 pt-5 text-[13px] font-semibold">Insights</div>
      <div className="flex flex-col gap-2.5 px-5 pt-2">
        {insights.map((ins, i) => (
          <div
            key={i}
            onClick={() => (ins.exerciseId ? navigate(`/exercise/${ins.exerciseId}`) : navigate('/stats/overview'))}
            className="cursor-pointer rounded-2xl border p-3.5 text-[13px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', lineHeight: 1.4 }}
          >
            {ins.text}
          </div>
        ))}
        {!insights.length && <div className="text-sm" style={{ color: 'var(--muted)' }}>Not enough history yet to surface insights — keep logging.</div>}
      </div>
    </div>
  )
}
