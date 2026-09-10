import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import ConfirmSheet from '../components/ConfirmSheet'
import TimerRing from '../components/TimerRing'
import { BackIcon, ClockIcon } from '../components/Icons'
import { exerciseById, unitName } from '../lib/exercises'
import { lastSessionSets } from '../lib/selectors'
import { fmtElapsed, todayISO } from '../lib/format'
import { beep } from '../lib/beep'

export default function ActiveWorkout() {
  const { state, dispatch, exercises } = useStore()
  const navigate = useNavigate()
  const aw = state.activeWorkout
  const [now, setNow] = useState(() => Date.now())
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [prBadge, setPrBadge] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const dingPlayedFor = useRef(null)
  const finishingRef = useRef(false)
  const expandedRef = useRef(null)

  // Hoisted above the `if (!aw) return null` guard below (null-guarded
  // here) so the finishRequested effect — a hook, which the Rules of Hooks
  // forbid placing after a conditional return — can call the exact same
  // finish() the in-app Finish button uses, rather than duplicating its
  // confirm-sheet-or-finish decision.
  const allSetsLogged = aw ? aw.exercises.every((ex) => ex.sets.every((s) => s.done)) : false

  // useCallback (not plain functions) specifically so the finishRequested
  // effect below can list `finish` in its dependency array correctly,
  // rather than either omitting it or re-running on every render.
  const doFinish = useCallback(() => {
    finishingRef.current = true
    dispatch({ type: 'FINISH_WORKOUT', payload: { note: '' } })
    navigate('/workout/summary')
  }, [dispatch, navigate])

  const finish = useCallback(() => {
    if (!allSetsLogged) { setConfirmFinish(true); return }
    doFinish()
  }, [allSetsLogged, doFinish])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    if (!aw?.restUntil) { dingPlayedFor.current = null; return }
    const remaining = new Date(aw.restUntil).getTime() - now
    // Keyed on the deadline itself, not a plain boolean: REST_ADJUST moves
    // restUntil to a new timestamp, so a "+15s" tap after the ding already
    // fired must be able to ding again when the new deadline arrives.
    if (remaining <= 0 && dingPlayedFor.current !== aw.restUntil) {
      dingPlayedFor.current = aw.restUntil
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

  // Brings the expanded card into view when the current exercise changes —
  // scrollIntoView is undefined in jsdom, hence the optional call.
  useEffect(() => {
    expandedRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [aw?.currentIndex])

  useEffect(() => {
    if (!aw && !finishingRef.current) navigate('/routines', { replace: true })
  }, [aw, navigate])

  // Notification "Finish" tap (Phase 9, NOTIF-15) — App.jsx's Shell already
  // navigated here if this screen wasn't already showing. Clear the flag
  // before calling finish(), not after, so a finish() that itself triggers
  // FINISH_WORKOUT can never re-enter this branch with a stale-true flag.
  useEffect(() => {
    if (!aw?.finishRequested) return
    dispatch({ type: 'SET_FINISH_REQUESTED', payload: false })
    finish()
  }, [aw?.finishRequested, finish, dispatch])

  if (!aw) return null

  const elapsedSec = Math.floor((now - new Date(aw.startedAt).getTime()) / 1000)
  const doneExercises = aw.exercises.filter((ex) => ex.sets.every((s) => s.done)).length
  const progressPct = Math.round((doneExercises / aw.exercises.length) * 100)

  const restRemaining = aw.restUntil ? Math.max(0, Math.ceil((new Date(aw.restUntil).getTime() - now) / 1000)) : 0
  const restTotal = aw.restTotalSec || 90
  const restVisible = aw.restUntil && restRemaining > 0

  const prExercise = prBadge ? aw.exercises[prBadge.exerciseIndex] : null
  const prExerciseId = prExercise
    ? (prExercise.blockType === 'superset' ? prExercise.exerciseIds[prExercise.sets[prBadge.setIndex]?.exerciseIndex] : prExercise.exerciseId)
    : null
  const prVisible = !!prExercise

  return (
    <div className="relative flex h-screen flex-col">
      <div className="flex-1 overflow-auto pb-24">
        <div className="relative px-[18px] pb-2 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => navigate('/routines')} className="-ml-1.5 shrink-0 p-1.5"><BackIcon /></button>
            <div className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold">{aw.routineName}</div>
            <div className="tabular-nums shrink-0 text-sm font-semibold" style={{ color: 'var(--accent-dark)' }}>{fmtElapsed(elapsedSec)}</div>
            <button onClick={() => setMenuOpen((v) => !v)} className="-mr-1.5 shrink-0 px-1.5 text-lg" style={{ color: 'var(--muted)' }}>⋮</button>
          </div>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-3 top-12 z-10 flex flex-col overflow-hidden rounded-xl border shadow-lg" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <button onClick={() => { setMenuOpen(false); setConfirmRestart(true) }} className="whitespace-nowrap px-4 py-2.5 text-left text-sm">
                  Restart workout
                </button>
                <button onClick={() => { setMenuOpen(false); setConfirmDiscard(true) }} className="whitespace-nowrap px-4 py-2.5 text-left text-sm" style={{ color: 'var(--danger)' }}>
                  Discard workout
                </button>
              </div>
            </>
          )}
          <div className="mt-2 h-[5px] overflow-hidden rounded-full" style={{ background: 'var(--surface-alt)' }}>
            <div className="h-full rounded-full transition-[width]" style={{ width: `${progressPct}%`, background: 'var(--accent)' }} />
          </div>
        </div>

        {aw.notifFallback && (
          <div className="mx-[18px] mt-1.5 rounded-xl p-2.5 text-xs" style={{ background: 'var(--surface-alt)', color: 'var(--muted)' }}>
            Notifications are blocked, so rest alerts only work while this screen stays open. Enable them in Settings or your system notification settings.
          </div>
        )}

        <div className="flex flex-col gap-2 px-[18px] py-1.5">
          {aw.exercises.map((ex, i) => {
            const active = i === aw.currentIndex
            return (
              <div key={`${ex.blockId}:${i}`} ref={active ? expandedRef : null}>
                {active ? (
                  <ExpandedExercise
                    unit={ex}
                    index={i}
                    restUntil={aw.restUntil}
                    restExerciseIndex={aw.restExerciseIndex}
                    restSetIndex={aw.restSetIndex}
                    restRemaining={restRemaining}
                  />
                ) : (
                  <CollapsedExerciseRow unit={ex} exercises={exercises} onSelect={() => dispatch({ type: 'GOTO_EXERCISE', payload: i })} />
                )}
              </div>
            )
          })}
        </div>

        {prVisible && (
          <div className="sticky top-0 z-10 flex justify-center py-1.5" style={{ pointerEvents: 'none' }}>
            <div className="pr-pop rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg" style={{ background: 'var(--accent)' }}>
              🏆 New PR — {exerciseById(prExerciseId, exercises)?.name || prExerciseId}
            </div>
          </div>
        )}

        {restVisible && (
          <div className="sticky bottom-0 z-10 flex items-center gap-4 border-t px-5 py-3.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <TimerRing remaining={restRemaining} total={restTotal} />
            <div className="flex-1 text-[13px]" style={{ color: 'var(--muted)' }}>Resting</div>
            <button onClick={() => dispatch({ type: 'REST_ADJUST', payload: -15 })} className="rounded-[10px] border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border)' }}>−15s</button>
            <button onClick={() => dispatch({ type: 'REST_ADJUST', payload: 15 })} className="rounded-[10px] border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border)' }}>+15s</button>
            <button onClick={() => dispatch({ type: 'REST_SKIP' })} className="rounded-[10px] px-3 py-1.5 text-xs font-semibold text-white" style={{ background: 'var(--accent)' }}>Skip</button>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t px-[18px] pb-3.5 pt-2.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <button onClick={finish} className="w-full rounded-2xl py-3 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
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

      <ConfirmSheet
        open={confirmRestart}
        title="Restart this workout?"
        body="Every logged set will be cleared and the routine will start over from the top."
        confirmLabel="Restart"
        danger
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => { dispatch({ type: 'RESTART_WORKOUT' }); setConfirmRestart(false) }}
      />

      <ConfirmSheet
        open={confirmDiscard}
        title="Discard this workout?"
        body="Nothing logged in this session will be saved."
        confirmLabel="Discard"
        danger
        holdToConfirm
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => { dispatch({ type: 'DISCARD_WORKOUT' }); setConfirmDiscard(false) }}
      />
    </div>
  )
}

// A non-current exercise in the vertical list — name, target, and a
// done-count, the whole row doubling as the GOTO_EXERCISE button. This is
// what replaces the old horizontal chip strip's random-access navigation.
function CollapsedExerciseRow({ unit, exercises, onSelect }) {
  const total = unit.sets.length
  const done = unit.sets.filter((s) => s.done).length
  const complete = total > 0 && done === total
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-2 rounded-2xl border p-3.5 text-left"
      style={{ borderColor: complete ? 'var(--accent)' : 'var(--border)', background: complete ? 'var(--accent-light)' : 'var(--surface)' }}
    >
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold" style={{ color: complete ? 'var(--accent-dark)' : 'var(--text)' }}>
          {unitName(unit, exercises)}
        </div>
        <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>Target {unit.target}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="tabular-nums text-xs font-semibold" style={{ color: complete ? 'var(--accent-dark)' : 'var(--muted)' }}>{done}/{total} sets</span>
        {complete && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: 'var(--accent)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><path d="M5 13l4 4L19 7" /></svg>
          </span>
        )}
      </div>
    </button>
  )
}

// Owns everything specific to viewing/logging ONE exercise unit: the ghost
// (last-session) lookups, the weight/reps focus-chain refs, and the help
// panel toggle. Kept as a real component — not an inline branch — so those
// hooks (the ghost useMemo especially, an O(sessions × entries) scan) exist
// only for the unit currently expanded, not for every unit in the list.
function ExpandedExercise({ unit, index, restUntil, restExerciseIndex, restSetIndex, restRemaining }) {
  const { state, dispatch, exercises } = useStore()
  const [helpOpen, setHelpOpen] = useState(false)
  const weightRefs = useRef({})
  const repsRefs = useRef({})

  const isSuperset = unit.blockType === 'superset'
  const unitExerciseIds = isSuperset ? unit.exerciseIds : [unit.exerciseId]
  // Depends on unit.exerciseId/exerciseIds directly (not the derived
  // unitExerciseIds array, which is a fresh literal every render for a
  // single-exercise unit) so this only re-scans state.sessions when the
  // unit's own identity actually changes, not on every keystroke.
  const ghostByExercise = useMemo(
    () => unitExerciseIds.map((exId) => lastSessionSets(state.sessions, exId, todayISO())),
    [state.sessions, unit.exerciseId, unit.exerciseIds]
  )
  function ghostFor(si) {
    const exIdx = unit.sets[si].exerciseIndex
    const roundIdx = Math.floor(si / unitExerciseIds.length)
    return ghostByExercise[exIdx]?.[roundIdx]
  }

  return (
    <div className="rounded-[20px] border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-serif text-[19px] font-semibold truncate">{unitName(unit, exercises)}</div>
          <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>Target {unit.target}</div>
        </div>
        {!isSuperset && (
          <button
            onClick={() => setHelpOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            ?
          </button>
        )}
      </div>
      {!isSuperset && helpOpen && (
        <div className="mt-2 rounded-xl p-2.5 text-xs" style={{ background: 'var(--surface-alt)', color: 'var(--muted)' }}>
          {state.exerciseNotes[unit.exerciseId] || 'Control the eccentric, keep tension on the target muscle, and stop 1-2 reps shy of failure.'}
        </div>
      )}

      {!isSuperset && (
        <div className="mt-4 grid grid-cols-[28px_1fr_1fr_1fr_30px] items-center gap-2 text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
          <span>Set</span><span>Last</span><span>Weight</span><span>Reps</span><span />
        </div>
      )}

      {unit.sets.map((set, si) => {
        const restSeconds = unit.restAfter[si]
        const restState = !set.done ? 'upcoming'
          : (restUntil && restExerciseIndex === index && restSetIndex === si) ? 'active'
            : 'passed'
        const restRow = restSeconds != null && (
          <RestRow key={`rest-${si}`} seconds={restSeconds} rowState={restState} remaining={restRemaining} />
        )

        if (!isSuperset) {
          return (
            <div key={si}>
              <SetRow
                exerciseIndex={index}
                setIndex={si}
                set={set}
                ghost={ghostFor(si)}
                targetWeight={unit.targetWeight}
                showRIR={state.settings.showRIR}
                isLastSet={si === unit.sets.length - 1}
                registerWeightRef={(el) => { weightRefs.current[si] = el }}
                registerRepsRef={(el) => { repsRefs.current[si] = el }}
                focusReps={() => repsRefs.current[si]?.focus()}
                focusNextWeightOrBlur={() => {
                  const next = weightRefs.current[si + 1]
                  if (next) next.focus()
                  else repsRefs.current[si]?.blur()
                }}
              />
              {restRow}
            </div>
          )
        }

        // Superset: group every unitExerciseIds.length consecutive
        // sets into one visually-grouped round, each row labeled by
        // the exercise it belongs to. Only the round's first position
        // opens the group wrapper; the rest ride along inside it.
        const posInRound = si % unitExerciseIds.length
        if (posInRound !== 0) return null
        const lastInRound = si + unitExerciseIds.length - 1
        const roundRestSeconds = unit.restAfter[lastInRound]
        const roundRestState = !unit.sets[lastInRound]?.done ? 'upcoming'
          : (restUntil && restExerciseIndex === index && restSetIndex === lastInRound) ? 'active'
            : 'passed'
        return (
          <div key={`round-${si}`} className="mt-2.5 rounded-xl p-2.5" style={{ background: 'var(--surface-alt)' }}>
            <div className="mb-1.5 text-[13px] font-bold" style={{ color: 'var(--muted)' }}>
              Round {Math.floor(si / unitExerciseIds.length) + 1}
            </div>
            {unitExerciseIds.map((exId, k) => {
              const rowIndex = si + k
              if (rowIndex >= unit.sets.length) return null
              return (
                <div key={rowIndex}>
                  <div className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>{exerciseById(exId, exercises)?.name || exId}</div>
                  <SetRow
                    exerciseIndex={index}
                    setIndex={rowIndex}
                    set={unit.sets[rowIndex]}
                    ghost={ghostFor(rowIndex)}
                    targetWeight={unit.targetWeight}
                    showRIR={state.settings.showRIR}
                    isLastSet={rowIndex === unit.sets.length - 1}
                    registerWeightRef={(el) => { weightRefs.current[rowIndex] = el }}
                    registerRepsRef={(el) => { repsRefs.current[rowIndex] = el }}
                    focusReps={() => repsRefs.current[rowIndex]?.focus()}
                    focusNextWeightOrBlur={() => {
                      const next = weightRefs.current[rowIndex + 1]
                      if (next) next.focus()
                      else repsRefs.current[rowIndex]?.blur()
                    }}
                  />
                </div>
              )
            })}
            {roundRestSeconds != null && (
              <RestRow seconds={roundRestSeconds} rowState={roundRestState} remaining={restRemaining} />
            )}
          </div>
        )
      })}

      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => dispatch({ type: 'ADD_SET', payload: { exerciseIndex: index } })}
          className="flex-1 rounded-[10px] border border-dashed p-2 text-xs font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--accent-dark)' }}
        >
          + Add Set
        </button>
        <button
          onClick={() => dispatch({ type: 'REMOVE_SET', payload: { exerciseIndex: index } })}
          className="flex-1 rounded-[10px] border border-dashed p-2 text-xs font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          − Remove Set
        </button>
      </div>
    </div>
  )
}

// Inline row reflecting the routine's authored rest plan (upcoming/active/
// passed), shown in the set list alongside — not instead of — the sticky
// bottom countdown overlay, which remains the live, actionable rest UI.
function RestRow({ seconds, rowState, remaining }) {
  const opacity = rowState === 'passed' ? 0.4 : rowState === 'upcoming' ? 0.6 : 1
  const label = rowState === 'active' ? `Rest — ${fmtElapsed(remaining)} left` : `Rest — ${seconds}s`
  return (
    <div
      className="my-1.5 flex items-center gap-2 rounded-lg border border-dashed p-2"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-alt)', opacity }}
    >
      <ClockIcon size={14} style={{ color: 'var(--muted)' }} />
      <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
    </div>
  )
}

function SetRow({
  exerciseIndex, setIndex, set, ghost, targetWeight, showRIR, isLastSet,
  registerWeightRef, registerRepsRef, focusReps, focusNextWeightOrBlur,
}) {
  const { dispatch } = useStore()

  function setField(field, value) {
    dispatch({ type: 'SET_SET_FIELD', payload: { exerciseIndex, setIndex, field, value } })
  }
  // Ghost value fills in on the first tap; the text is left selected so the
  // very next keystroke replaces it instead of appending after it. Falls
  // back to the block's target weight (weight field only) when there's no
  // real ghost — i.e. the first time this exercise is ever logged.
  function fillGhost(field, inputEl) {
    if (set[field] !== '') return
    const fallback = ghost ? ghost[field] : (field === 'weight' ? targetWeight : null)
    if (fallback == null) return
    setField(field, String(fallback))
    requestAnimationFrame(() => inputEl?.select())
  }

  // Dispatches the same TOGGLE_SET_DONE the checkmark button uses, once both
  // fields hold a valid value — the exact validity check reducer.js already
  // applies for PR detection. Fires only from a confirm action (below), never
  // mid-keystroke, and never un-marks a set (that stays a manual tap).
  function maybeAutoMarkDone() {
    if (set.done) return
    const weight = parseFloat(set.weight)
    const reps = parseInt(set.reps, 10)
    if (Number.isFinite(weight) && Number.isFinite(reps) && weight > 0 && reps > 0) {
      dispatch({ type: 'TOGGLE_SET_DONE', payload: { exerciseIndex, setIndex } })
    }
  }

  // Shifting focus to the next field for real (below) fires a genuine
  // native blur on the field currently losing focus once it actually held
  // focus — which re-enters this same confirm handler synchronously before
  // the outer call returns. Without a guard, that second entry would
  // re-dispatch TOGGLE_SET_DONE and cancel the first dispatch out (an
  // immediate re-toggle back to not-done). confirmingRef makes the confirm
  // sequence non-reentrant per row.
  const confirmingRef = useRef(false)

  function confirmWeight() {
    if (confirmingRef.current || set.weight === '') return
    confirmingRef.current = true
    maybeAutoMarkDone()
    focusReps()
    confirmingRef.current = false
  }

  function confirmReps() {
    if (confirmingRef.current || set.reps === '') return
    confirmingRef.current = true
    maybeAutoMarkDone()
    focusNextWeightOrBlur()
    confirmingRef.current = false
  }

  function onWeightKeyDown(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    confirmWeight()
  }

  function onRepsKeyDown(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    confirmReps()
  }

  const weightPlaceholder = ghost ? String(ghost.weight) : (targetWeight != null ? String(targetWeight) : '—')

  return (
    <div className="grid grid-cols-[28px_1fr_1fr_1fr_30px] items-center gap-2 border-t py-2" style={{ borderColor: 'var(--border)' }}>
      <span className="tabular-nums text-[13px] font-bold" style={{ color: 'var(--muted)' }}>{setIndex + 1}</span>
      <span className="tabular-nums text-xs" style={{ color: 'var(--muted)' }}>{ghost ? `${ghost.weight}×${ghost.reps}` : '—'}</span>
      <input
        ref={registerWeightRef}
        value={set.weight}
        onChange={(e) => setField('weight', e.target.value)}
        onFocus={(e) => fillGhost('weight', e.target)}
        onKeyDown={onWeightKeyDown}
        onBlur={confirmWeight}
        placeholder={weightPlaceholder}
        inputMode="decimal"
        enterKeyHint="next"
        className="tabular-nums w-full rounded-xl border p-2.5 text-center text-lg font-semibold"
        style={{ borderColor: 'var(--border)', background: set.done ? 'var(--accent-light)' : 'var(--surface)' }}
      />
      <input
        ref={registerRepsRef}
        value={set.reps}
        onChange={(e) => setField('reps', e.target.value)}
        onFocus={(e) => fillGhost('reps', e.target)}
        onKeyDown={onRepsKeyDown}
        onBlur={confirmReps}
        placeholder={ghost ? String(ghost.reps) : '—'}
        inputMode="numeric"
        enterKeyHint={isLastSet ? 'done' : 'next'}
        className="tabular-nums w-full rounded-xl border p-2.5 text-center text-lg font-semibold"
        style={{ borderColor: 'var(--border)', background: set.done ? 'var(--accent-light)' : 'var(--surface)' }}
      />
      <button
        onClick={() => dispatch({ type: 'TOGGLE_SET_DONE', payload: { exerciseIndex, setIndex } })}
        className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border ${set.done ? 'check-pop' : ''}`}
        style={{
          background: set.done ? 'var(--accent)' : 'transparent',
          borderColor: set.done ? 'var(--accent)' : 'var(--border)',
          color: '#fff',
          // Filled alone, the circle reads as a flat dark disc against the dark
          // theme's --bg. A white ring plus a soft outer glow separates it from
          // the surface so "done" is legible at a glance mid-set.
          boxShadow: set.done
            ? '0 0 0 2px rgba(255,255,255,0.55), 0 0 12px 2px rgba(255,255,255,0.28)'
            : 'none',
          transition: 'box-shadow 180ms ease-out',
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
