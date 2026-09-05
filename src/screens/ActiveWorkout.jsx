import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import ConfirmSheet from '../components/ConfirmSheet'
import { exerciseById } from '../lib/exercises'
import { lastSessionSets } from '../lib/selectors'
import { fmtElapsed, todayISO } from '../lib/format'

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch { /* audio not available */ }
}

export default function ActiveWorkout() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const aw = state.activeWorkout
  const [now, setNow] = useState(Date.now())
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [helpFor, setHelpFor] = useState(null)
  const [prBadge, setPrBadge] = useState(null)
  const dingPlayed = useRef(false)
  const finishingRef = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!aw?.restUntil) { dingPlayed.current = false; return }
    const remaining = new Date(aw.restUntil).getTime() - now
    if (remaining <= 0 && !dingPlayed.current) {
      dingPlayed.current = true
      beep()
      if (navigator.vibrate) navigator.vibrate(200)
    }
  }, [aw?.restUntil, now])

  useEffect(() => {
    if (!aw?.lastPR) return
    setPrBadge(aw.lastPR)
    const t = setTimeout(() => setPrBadge(null), 2600)
    return () => clearTimeout(t)
  }, [aw?.lastPR])

  useEffect(() => {
    if (!aw && !finishingRef.current) navigate('/routines', { replace: true })
  }, [aw, navigate])

  if (!aw) return null

  const elapsedSec = Math.floor((now - new Date(aw.startedAt).getTime()) / 1000)
  const doneExercises = aw.exercises.filter((ex) => ex.sets.every((s) => s.done)).length
  const progressPct = Math.round((doneExercises / aw.exercises.length) * 100)
  const current = aw.exercises[aw.currentIndex]
  const currentExerciseInfo = exerciseById(current.exerciseId)
  const ghostSets = lastSessionSets(state.sessions, current.exerciseId, todayISO())

  const restRemaining = aw.restUntil ? Math.max(0, Math.ceil((new Date(aw.restUntil).getTime() - now) / 1000)) : 0
  const restTotal = aw.restExerciseIndex != null ? aw.exercises[aw.restExerciseIndex]?.rest || 90 : 90
  const restVisible = aw.restUntil && restRemaining > 0
  const showNoRestHint = current.blockType === 'superset' && current.pairIndex < current.pairSize - 1

  const prExercise = prBadge ? aw.exercises[prBadge.exerciseIndex] : null
  const prVisible = !!prExercise

  const allSetsLogged = aw.exercises.every((ex) => ex.sets.every((s) => s.done))

  function finish() {
    if (!allSetsLogged) { setConfirmFinish(true); return }
    doFinish()
  }
  function doFinish() {
    finishingRef.current = true
    dispatch({ type: 'FINISH_WORKOUT', payload: { note: '' } })
    navigate('/workout/summary')
  }

  const circumference = 2 * Math.PI * 24
  const ringOffset = restTotal > 0 ? circumference * (1 - restRemaining / restTotal) : 0

  return (
    <div className="relative flex h-screen flex-col">
      <div className="flex-1 overflow-auto pb-24">
        <div className="px-[18px] pb-2 pt-3.5">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-semibold">{aw.routineName}</div>
            <div className="tabular-nums text-sm font-semibold" style={{ color: 'var(--accent-dark)' }}>{fmtElapsed(elapsedSec)}</div>
          </div>
          <div className="mt-2 h-[5px] overflow-hidden rounded-full" style={{ background: 'var(--surface-alt)' }}>
            <div className="h-full rounded-full transition-[width]" style={{ width: `${progressPct}%`, background: 'var(--accent)' }} />
          </div>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto px-[18px] pb-2.5 pt-1.5">
          {aw.exercises.map((ex, i) => {
            const done = ex.sets.every((s) => s.done)
            const active = i === aw.currentIndex
            return (
              <button
                key={i}
                onClick={() => dispatch({ type: 'GOTO_EXERCISE', payload: i })}
                className="shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold"
                style={{
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  background: active ? 'var(--accent)' : done ? 'var(--accent-light)' : 'var(--surface)',
                  color: active ? '#fff' : done ? 'var(--accent-dark)' : 'var(--text)',
                }}
              >
                {exerciseById(ex.exerciseId)?.name || ex.exerciseId}
              </button>
            )
          })}
        </div>

        <div className="px-[18px] py-1.5">
          <div className="rounded-[20px] border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-serif text-[19px] font-semibold">{currentExerciseInfo?.name}</div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>Target {current.target}</div>
              </div>
              <button
                onClick={() => setHelpFor(helpFor === current.exerciseId ? null : current.exerciseId)}
                className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                ?
              </button>
            </div>
            {helpFor === current.exerciseId && (
              <div className="mt-2 rounded-xl p-2.5 text-xs" style={{ background: 'var(--surface-alt)', color: 'var(--muted)' }}>
                {state.exerciseNotes[current.exerciseId] || 'Control the eccentric, keep tension on the target muscle, and stop 1-2 reps shy of failure.'}
              </div>
            )}

            {showNoRestHint && (
              <div className="mt-2 rounded-xl px-3 py-1.5 text-center text-xs font-semibold" style={{ background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>
                No rest — next exercise
              </div>
            )}

            <div className="mt-4 grid grid-cols-[28px_1fr_1fr_1fr_30px] items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
              <span>Set</span><span>Last</span><span>Weight</span><span>Reps</span><span />
            </div>

            {current.sets.map((set, si) => (
              <SetRow
                key={si}
                exerciseIndex={aw.currentIndex}
                setIndex={si}
                set={set}
                ghost={ghostSets?.[si]}
                showRIR={state.settings.showRIR}
              />
            ))}

            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => dispatch({ type: 'ADD_SET', payload: { exerciseIndex: aw.currentIndex } })}
                className="flex-1 rounded-[10px] border border-dashed p-2 text-xs font-semibold"
                style={{ borderColor: 'var(--border)', color: 'var(--accent-dark)' }}
              >
                + Add Set
              </button>
              <button
                onClick={() => dispatch({ type: 'REMOVE_SET', payload: { exerciseIndex: aw.currentIndex } })}
                className="flex-1 rounded-[10px] border border-dashed p-2 text-xs font-semibold"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                − Remove Set
              </button>
            </div>
          </div>
        </div>

        {prVisible && (
          <div className="sticky top-0 z-10 flex justify-center py-1.5" style={{ pointerEvents: 'none' }}>
            <div className="pr-pop rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg" style={{ background: 'var(--accent)' }}>
              🏆 New PR — {exerciseById(prExercise.exerciseId)?.name}
            </div>
          </div>
        )}

        {restVisible && (
          <div className="sticky bottom-0 z-10 flex items-center gap-4 border-t px-5 py-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="relative h-14 w-14 shrink-0">
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="var(--surface-alt)" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="24" fill="none" stroke="var(--accent)" strokeWidth="5"
                  strokeDasharray={circumference} strokeDashoffset={ringOffset}
                  transform="rotate(-90 28 28)" strokeLinecap="round"
                />
              </svg>
              <div className="tabular-nums absolute inset-0 flex items-center justify-center text-[13px] font-bold">{fmtElapsed(restRemaining)}</div>
            </div>
            <div className="flex-1 text-[13px]" style={{ color: 'var(--muted)' }}>Resting</div>
            <button onClick={() => dispatch({ type: 'REST_ADJUST', payload: -15 })} className="rounded-[10px] border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border)' }}>−15s</button>
            <button onClick={() => dispatch({ type: 'REST_ADJUST', payload: 15 })} className="rounded-[10px] border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border)' }}>+15s</button>
            <button onClick={() => dispatch({ type: 'REST_SKIP' })} className="rounded-[10px] px-3 py-1.5 text-xs font-semibold text-white" style={{ background: 'var(--accent)' }}>Skip</button>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t px-[18px] pb-3.5 pt-2.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <button onClick={finish} className="w-full rounded-2xl py-3 text-sm font-semibold text-white" style={{ background: 'var(--text)' }}>
          Finish Workout
        </button>
      </div>

      <ConfirmSheet
        open={confirmFinish}
        title="Finish with sets left?"
        body="Not every set is checked off yet. Unlogged sets won't be saved to your history."
        confirmLabel="Finish anyway"
        onCancel={() => setConfirmFinish(false)}
        onConfirm={doFinish}
      />
    </div>
  )
}

function SetRow({ exerciseIndex, setIndex, set, ghost, showRIR }) {
  const { dispatch } = useStore()

  function setField(field, value) {
    dispatch({ type: 'SET_SET_FIELD', payload: { exerciseIndex, setIndex, field, value } })
  }
  // Ghost value fills in on the first tap; the text is left selected so the
  // very next keystroke replaces it instead of appending after it.
  function fillGhost(field, inputEl) {
    if (set[field] !== '' || !ghost) return
    setField(field, String(ghost[field]))
    requestAnimationFrame(() => inputEl?.select())
  }

  return (
    <div className="grid grid-cols-[28px_1fr_1fr_1fr_30px] items-center gap-2 border-t py-2" style={{ borderColor: 'var(--border)' }}>
      <span className="tabular-nums text-[13px] font-bold" style={{ color: 'var(--muted)' }}>{setIndex + 1}</span>
      <span className="tabular-nums text-xs" style={{ color: 'var(--muted)' }}>{ghost ? `${ghost.weight}×${ghost.reps}` : '—'}</span>
      <input
        value={set.weight}
        onChange={(e) => setField('weight', e.target.value)}
        onFocus={(e) => fillGhost('weight', e.target)}
        placeholder={ghost ? String(ghost.weight) : '—'}
        inputMode="decimal"
        className="tabular-nums w-full rounded-lg border p-1.5 text-center text-[13px]"
        style={{ borderColor: 'var(--border)', background: set.done ? 'var(--accent-light)' : 'var(--surface)' }}
      />
      <input
        value={set.reps}
        onChange={(e) => setField('reps', e.target.value)}
        onFocus={(e) => fillGhost('reps', e.target)}
        placeholder={ghost ? String(ghost.reps) : '—'}
        inputMode="numeric"
        className="tabular-nums w-full rounded-lg border p-1.5 text-center text-[13px]"
        style={{ borderColor: 'var(--border)', background: set.done ? 'var(--accent-light)' : 'var(--surface)' }}
      />
      <button
        onClick={() => dispatch({ type: 'TOGGLE_SET_DONE', payload: { exerciseIndex, setIndex } })}
        className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border ${set.done ? 'check-pop' : ''}`}
        style={{
          background: set.done ? 'var(--accent)' : 'transparent',
          borderColor: set.done ? 'var(--accent)' : 'var(--border)',
          color: '#fff',
        }}
      >
        {set.done && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
      </button>
      {showRIR && (
        <div className="col-span-5 -mt-1 flex gap-1.5 pl-9">
          {[0, 1, 2, 3].map((r) => (
            <button
              key={r}
              onClick={() => setField('rir', r)}
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
}
