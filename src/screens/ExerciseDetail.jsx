import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import Card from '../components/Card'
import SegmentedControl from '../components/SegmentedControl'
import LineChart from '../components/LineChart'
import { BackIcon } from '../components/Icons'
import { exerciseById } from '../lib/exercises'
import { exerciseHistory, prByRepRange } from '../lib/selectors'
import { fmtDate } from '../lib/format'

function epley1RM(weight, reps) {
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

export default function ExerciseDetail() {
  const { id } = useParams()
  const { state, dispatch, exercises } = useStore()
  const navigate = useNavigate()
  const [metric, setMetric] = useState('weight')
  const [notes, setNotes] = useState(state.exerciseNotes[id] || '')

  const ex = exerciseById(id, exercises)
  const history = useMemo(() => exerciseHistory(state.sessions, id), [state.sessions, id])
  const prTable = useMemo(() => prByRepRange(state.sessions, id), [state.sessions, id])

  const series = useMemo(() => {
    return history.map((h) => {
      const top = h.sets.reduce((best, s) => (s.weight * s.reps > best.weight * best.reps ? s : best), h.sets[0])
      let value = top.weight
      if (metric === '1rm') value = epley1RM(top.weight, top.reps)
      else if (metric === 'volume') value = h.sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
      else if (metric === 'reps') value = h.sets.reduce((sum, s) => sum + s.reps, 0)
      return { date: h.date, value }
    })
  }, [history, metric])

  useEffect(() => {
    if (!ex) navigate(-1)
  }, [ex, navigate])

  if (!ex) return null

  function saveNotes() {
    dispatch({ type: 'UPDATE_EXERCISE_NOTES', payload: { exerciseId: id, notes } })
  }

  return (
    <div className="pb-8">
      <div className="p-3.5"><button onClick={() => navigate(-1)} className="p-1.5"><BackIcon /></button></div>

      <div className="px-5">
        <div className="font-serif text-[22px] font-semibold">{ex.name}</div>
        <div className="mt-1.5 flex gap-1.5">
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>{ex.primary}</span>
          {ex.secondary && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--surface-alt)', color: 'var(--muted)' }}>{ex.secondary}</span>}
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="mb-2.5">
          <SegmentedControl
            value={metric}
            onChange={setMetric}
            options={[{ value: 'weight', label: 'Weight' }, { value: '1rm', label: 'Est. 1RM' }, { value: 'volume', label: 'Volume' }, { value: 'reps', label: 'Reps' }]}
          />
        </div>
        <Card>
          <LineChart series={series} />
        </Card>
      </div>

      <div className="px-5 pt-5">
        <div className="mb-2 text-[13px] font-semibold">PRs by rep range</div>
        <div className="flex flex-col overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          {prTable.map((pr) => (
            <div key={pr.reps} className="flex justify-between border-b p-3 text-[13px] last:border-0" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>Best @ {pr.reps} reps</span>
              <span className="tabular-nums font-semibold">{pr.weight || '—'}{pr.weight ? 'kg' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="mb-2 text-[13px] font-semibold">History</div>
        <div className="flex flex-col overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          {[...history].reverse().map((h) => (
            <div key={h.sessionId} onClick={() => navigate('/stats/log')} className="flex cursor-pointer justify-between border-b p-3 text-[13px] last:border-0" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>{fmtDate(h.date)}</span>
              <span className="tabular-nums">{h.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')}</span>
            </div>
          ))}
          {!history.length && <div className="p-4 text-center text-sm" style={{ color: 'var(--muted)' }}>Not logged yet.</div>}
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="mb-2 text-[13px] font-semibold">Notes</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Cues, form notes…"
          className="w-full rounded-2xl border p-3 text-[13px]"
          style={{ borderColor: 'var(--border)', minHeight: 60 }}
        />
      </div>
    </div>
  )
}
