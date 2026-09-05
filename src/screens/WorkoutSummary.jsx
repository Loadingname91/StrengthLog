import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import { fmtElapsed } from '../lib/format'

export default function WorkoutSummary() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const session = state.lastFinishedSession
  const [note, setNote] = useState(session?.note || '')

  useEffect(() => {
    if (!session) navigate('/', { replace: true })
  }, [session, navigate])

  if (!session) return null

  function done() {
    if (note.trim()) dispatch({ type: 'UPDATE_SESSION_NOTE', payload: { id: session.id, note: note.trim() } })
    navigate('/')
  }

  return (
    <div className="px-6 py-7 text-center">
      <div className="text-4xl">🎉</div>
      <div className="font-serif mt-2 text-2xl font-semibold">Workout complete</div>
      <div className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>
        {session.routineName} · {fmtElapsed(session.durationSec)}
      </div>

      <div className="mt-5 flex justify-center gap-4">
        <div className="rounded-2xl border px-5 py-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="text-lg font-bold">{session.volume}</div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Volume (kg)</div>
        </div>
        <div className="rounded-2xl border px-5 py-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{session.prCount}</div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>PRs hit</div>
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note about this session…"
        className="mt-5 w-full rounded-2xl border p-3 text-[13px]"
        style={{ borderColor: 'var(--border)', minHeight: 70 }}
      />

      <button onClick={done} className="mt-4 w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white" style={{ background: 'var(--accent)' }}>
        Done
      </button>
    </div>
  )
}
