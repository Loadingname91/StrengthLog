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
  const [conflict, setConflict] = useState(null) // null | 'repeat' | 'resume'
  const [editing, setEditing] = useState(false)

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
    if (state.activeWorkout) { setConflict('repeat'); return }
    dispatch({ type: 'START_WORKOUT', payload: { routineId: session.routineId } })
    navigate('/workout')
  }

  function resume() {
    setMenuOpen(false)
    if (state.activeWorkout) { setConflict('resume'); return }
    dispatch({ type: 'RESUME_SESSION', payload: { id: session.id } })
    navigate('/workout')
  }

  function confirmOverActive() {
    const action = conflict
    dispatch({ type: 'DISCARD_WORKOUT' })
    if (action === 'repeat') dispatch({ type: 'START_WORKOUT', payload: { routineId: session.routineId } })
    else dispatch({ type: 'RESUME_SESSION', payload: { id: session.id } })
    setConflict(null)
    navigate('/workout')
  }

  function deleteSession() {
    dispatch({ type: 'DELETE_SESSION', payload: session.id })
    showToast('Workout deleted')
    navigate('/stats/log', { replace: true })
  }

  function updateSet(entryIndex, setIndex, field, value) {
    dispatch({ type: 'EDIT_SESSION_SET', payload: { sessionId: session.id, entryIndex, setIndex, field, value } })
  }

  return (
    <div className="pb-6">
      <div className="relative flex items-center justify-between px-4 pt-[max(16px,env(safe-area-inset-top))]">
        <button onClick={() => navigate(-1)} className="p-1.5"><BackIcon /></button>
        <div className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">{session.routineName}</div>
        <button onClick={() => setMenuOpen((v) => !v)} className="shrink-0 px-1.5 text-lg" style={{ color: 'var(--muted)' }}>⋮</button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-3 top-12 z-10 flex flex-col overflow-hidden rounded-xl border shadow-lg" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <button
                onClick={() => { setMenuOpen(false); setEditing((v) => !v) }}
                className="whitespace-nowrap px-4 py-2.5 text-left text-sm"
              >
                {editing ? 'Done editing' : 'Edit entries'}
              </button>
              <button
                onClick={resume}
                className="whitespace-nowrap px-4 py-2.5 text-left text-sm"
              >
                Resume workout
              </button>
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
        <Stat label={`Volume (${state.settings.units})`} value={session.volume} />
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
              {entry.sets.map((set, j) => {
                const isTimed = set.weight === 0 && set.reps === 0 && set.durationSec != null
                return (
                  <div key={j} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--muted)' }}>Set {j + 1}</span>
                      {editing ? (
                        <div className="flex items-center gap-1.5">
                          {isTimed ? (
                            <>
                              <EditableNumber
                                value={set.durationSec}
                                integer
                                onCommit={(v) => updateSet(i, j, 'durationSec', v)}
                              />
                              <span style={{ color: 'var(--muted)' }}>s</span>
                            </>
                          ) : (
                            <>
                              <EditableNumber value={set.weight} onCommit={(v) => updateSet(i, j, 'weight', v)} />
                              <span style={{ color: 'var(--muted)' }}>{state.settings.units} ×</span>
                              <EditableNumber value={set.reps} integer onCommit={(v) => updateSet(i, j, 'reps', v)} />
                            </>
                          )}
                          {set.isPR && <span title="PR">🏆</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {state.settings.showRIR && set.rir != null && (
                            <span style={{ color: 'var(--muted)' }}>RIR {set.rir}</span>
                          )}
                          <span className="tabular-nums font-semibold">
                            {isTimed
                              ? `${set.durationSec}s`
                              : `${set.weight}${state.settings.units} × ${set.reps}${set.durationSec != null ? ` · ${set.durationSec}s` : ''}`}
                          </span>
                          {set.isPR && <span title="PR">🏆</span>}
                        </div>
                      )}
                    </div>
                    {editing && state.settings.showRIR && !isTimed && (
                      <div className="flex justify-end gap-1.5">
                        {[0, 1, 2, 3].map((r) => (
                          <button
                            key={r}
                            onClick={() => updateSet(i, j, 'rir', r)}
                            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              borderColor: set.rir === r ? 'var(--accent)' : 'var(--border)',
                              background: set.rir === r ? 'var(--accent-light)' : 'transparent',
                              color: set.rir === r ? 'var(--accent-dark)' : 'var(--muted)',
                            }}
                          >
                            {r === 3 ? '3+' : r} RIR
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
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
        open={conflict != null}
        title="A workout is already in progress"
        body={conflict === 'resume'
          ? 'Resuming this workout will discard the one you\'re currently running.'
          : 'Repeating this workout will discard the one you\'re currently running.'}
        confirmLabel={conflict === 'resume' ? 'Discard & resume' : 'Discard & start new'}
        danger
        onCancel={() => setConflict(null)}
        onConfirm={confirmOverActive}
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

// Free-typing number input over a numeric session value: local text state so
// a partial entry like "1." isn't stomped back to "1" by the controlled
// value on every keystroke. Commits (and coerces back to the stored number
// on anything invalid) only on blur, mirroring ActiveWorkout's set inputs.
function EditableNumber({ value, integer = false, onCommit }) {
  const [text, setText] = useState(String(value))

  useEffect(() => { setText(String(value)) }, [value])

  function commit() {
    const parsed = integer ? parseInt(text, 10) : parseFloat(text)
    if (Number.isFinite(parsed) && parsed >= 0) onCommit(parsed)
    else setText(String(value))
  }

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      inputMode={integer ? 'numeric' : 'decimal'}
      className="tabular-nums w-14 rounded-lg border p-1 text-right text-xs font-semibold"
      style={{ borderColor: 'var(--border)' }}
    />
  )
}
