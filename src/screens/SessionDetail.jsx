import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import { useToast } from '../state/ToastContext'
import ConfirmSheet from '../components/ConfirmSheet'
import { BackIcon } from '../components/Icons'
import { exerciseById } from '../lib/exercises'
import { totalSets } from '../lib/selectors'
import { fmtDateLong, fmtElapsed } from '../lib/format'

export default function SessionDetail() {
  const { id } = useParams()
  const { state, dispatch, exercises } = useStore()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [conflict, setConflict] = useState(false)

  const session = state.sessions.find((s) => s.id === id)
  const [note, setNote] = useState(session?.note || '')

  useEffect(() => {
    if (!session) navigate('/stats/log', { replace: true })
  }, [session, navigate])

  const routine = useMemo(() => state.routines.find((r) => r.id === session?.routineId), [state.routines, session])

  if (!session) return null

  function saveNote() {
    if (note !== session.note) dispatch({ type: 'UPDATE_SESSION_NOTE', payload: { id: session.id, note } })
  }

  function repeat() {
    setMenuOpen(false)
    if (state.activeWorkout) { setConflict(true); return }
    dispatch({ type: 'START_WORKOUT', payload: { routineId: session.routineId } })
    navigate('/workout')
  }

  function confirmRepeatOverActive() {
    dispatch({ type: 'DISCARD_WORKOUT' })
    dispatch({ type: 'START_WORKOUT', payload: { routineId: session.routineId } })
    setConflict(false)
    navigate('/workout')
  }

  function deleteSession() {
    dispatch({ type: 'DELETE_SESSION', payload: session.id })
    showToast('Workout deleted')
    navigate('/stats/log', { replace: true })
  }

  return (
    <div className="pb-6">
      <div className="relative flex items-center justify-between px-4 pt-4">
        <button onClick={() => navigate(-1)} className="p-1.5"><BackIcon /></button>
        <div className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">{session.routineName}</div>
        <button onClick={() => setMenuOpen((v) => !v)} className="shrink-0 px-1.5 text-lg" style={{ color: 'var(--muted)' }}>⋮</button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-3 top-12 z-10 flex flex-col overflow-hidden rounded-xl border shadow-lg" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <button
                onClick={repeat}
                disabled={!routine}
                className="whitespace-nowrap px-4 py-2.5 text-left text-sm"
                style={{ opacity: routine ? 1 : 0.4 }}
              >
                Repeat workout
              </button>
              <button
                onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                className="whitespace-nowrap px-4 py-2.5 text-left text-sm"
                style={{ color: 'var(--danger)' }}
              >
                Delete workout
              </button>
            </div>
          </>
        )}
      </div>

      <div className="px-5 pt-1 text-center text-xs" style={{ color: 'var(--muted)' }}>
        {fmtDateLong(session.date)}{session.durationSec > 0 && <> · {fmtElapsed(session.durationSec)}</>}
      </div>

      <div className="flex justify-center gap-4 px-5 pb-1 pt-4">
        <Stat label="Volume (kg)" value={session.volume} />
        <Stat label="Sets" value={totalSets(session)} />
        <Stat label="PRs" value={session.prCount} accent={session.prCount > 0} />
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-4">
        {session.entries.map((entry, i) => (
          <div key={i} className="rounded-2xl border p-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div onClick={() => navigate(`/exercise/${entry.exerciseId}`)} className="cursor-pointer text-sm font-semibold">
              {exerciseById(entry.exerciseId, exercises)?.name || entry.exerciseId}
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {entry.sets.map((set, j) => (
                <div key={j} className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--muted)' }}>Set {j + 1}</span>
                  <div className="flex items-center gap-2">
                    {state.settings.showRIR && set.rir != null && (
                      <span style={{ color: 'var(--muted)' }}>RIR {set.rir}</span>
                    )}
                    <span className="tabular-nums font-semibold">{set.weight}kg × {set.reps}</span>
                    {set.isPR && <span title="PR">🏆</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pt-5">
        <div className="mb-2 text-[13px] font-semibold">Note</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          placeholder="Add a note about this session…"
          className="w-full rounded-2xl border p-3 text-[13px]"
          style={{ borderColor: 'var(--border)', minHeight: 70 }}
        />
      </div>

      <ConfirmSheet
        open={confirmDelete}
        title="Delete this workout?"
        body={`This permanently removes ${fmtDateLong(session.date)} from your history. Stats and PRs will update.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteSession}
      />

      <ConfirmSheet
        open={conflict}
        title="A workout is already in progress"
        body="Repeating this workout will discard the one you're currently running."
        confirmLabel="Discard & start new"
        danger
        onCancel={() => setConflict(false)}
        onConfirm={confirmRepeatOverActive}
      />
    </div>
  )
}

function Stat({ label, value, accent = false }) {
  return (
    <div className="rounded-2xl border px-5 py-3.5 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="text-lg font-bold" style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</div>
      <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}
