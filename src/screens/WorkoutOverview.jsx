import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import { useToast } from '../state/ToastContext'
import Sparkline from '../components/Sparkline'
import ConfirmSheet from '../components/ConfirmSheet'
import { BackIcon, ShareIcon, ClockIcon } from '../components/Icons'
import { exerciseById } from '../lib/exercises'
import { blockTarget, workoutCtaLabel } from '../lib/format'
import { topSetSparklinePoints, estimateDuration } from '../lib/selectors'
import { getBlockExercises, getBlockTotalSets, getBlockTotalReps } from '../lib/blocks'

export default function WorkoutOverview() {
  const { id } = useParams()
  const { state, dispatch, exercises } = useStore()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [conflict, setConflict] = useState(false)

  const routine = state.routines.find((r) => r.id === id)

  const rows = useMemo(() => {
    if (!routine) return []
    return routine.blocks.flatMap((block) => {
      const exList = getBlockExercises(block)
      return exList.map((ex) => ({
        exId: ex.exerciseId,
        name: exerciseById(ex.exerciseId, exercises)?.name || ex.exerciseId,
        target: blockTarget(ex),
        spark: topSetSparklinePoints(state.sessions, ex.exerciseId, 7),
      }))
    })
  }, [routine, state.sessions, exercises])

  useEffect(() => {
    if (!routine) navigate('/routines', { replace: true })
  }, [routine, navigate])

  if (!routine) return null

  const totalSets = routine.blocks.reduce((s, b) => s + getBlockTotalSets(b), 0)
  const totalReps = routine.blocks.reduce((s, b) => s + getBlockTotalReps(b), 0)
  const exerciseCount = routine.blocks.reduce((s, b) => s + (b.exerciseIds?.length || b.exercises?.length || 1), 0)

  function start() {
    // A workout for a DIFFERENT routine is already in progress — this is
    // the one screen where the user picked a specific routine to start, so
    // silently resuming the old one instead would be wrong. Offer to
    // discard it rather than doing so without asking.
    if (state.activeWorkout && state.activeWorkout.routineId !== routine.id) { setConflict(true); return }
    if (state.activeWorkout) { navigate('/workout'); return }
    dispatch({ type: 'START_WORKOUT', payload: { routineId: routine.id } })
    navigate('/workout')
  }

  function discardAndStart() {
    dispatch({ type: 'DISCARD_WORKOUT' })
    dispatch({ type: 'START_WORKOUT', payload: { routineId: routine.id } })
    setConflict(false)
    navigate('/workout')
  }

  async function share() {
    const text = `${routine.name} (${routine.position})\n${exerciseCount} exercises · ${totalSets} sets · ~${estimateDuration(routine, state.sessions)} min\n\n` +
      rows.map((r) => `• ${r.name} — ${r.target}`).join('\n')
    if (navigator.share) {
      try { await navigator.share({ title: routine.name, text }) } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      showToast('Routine summary copied')
    }
  }

  return (
    <div className="pb-6">
      <div className="flex justify-between px-4 pt-4">
        <button onClick={() => navigate('/routines')} className="p-1.5"><BackIcon /></button>
        <button onClick={share} className="p-1.5"><ShareIcon /></button>
      </div>

      <div className="flex justify-center pb-1 pt-2">
        <svg width="64" height="128" viewBox="0 0 60 120">
          <ellipse cx="30" cy="12" rx="9" ry="10" fill="#EFE3D3" />
          <rect x="17" y="24" width="26" height="34" rx="8" fill="var(--accent)" />
          <rect x="6" y="26" width="10" height="34" rx="5" fill="#E7B08C" />
          <rect x="44" y="26" width="10" height="34" rx="5" fill="#E7B08C" />
          <rect x="18" y="60" width="24" height="30" rx="6" fill="#F0D6BE" />
          <rect x="16" y="90" width="12" height="28" rx="5" fill="#F3E3D9" />
          <rect x="32" y="90" width="12" height="28" rx="5" fill="#F3E3D9" />
        </svg>
      </div>

      <div className="text-center">
        <div className="font-serif text-2xl font-semibold">{routine.name}</div>
        <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{routine.position}</div>
      </div>

      <div className="flex justify-center gap-6 px-5 pb-1 pt-4 text-center">
        <Stat label="Exercises" value={exerciseCount} />
        <Stat label="Sets" value={totalSets} />
        <Stat label="Reps" value={totalReps} />
      </div>

      <div className="px-5 py-3">
        <button
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          {workoutCtaLabel(state.activeWorkout, routine.id)}
          {/* The estimate describes a fresh run, so it only makes sense before one starts. */}
          {!state.activeWorkout && (
            <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.25)' }}>
              <ClockIcon size={12} />~{estimateDuration(routine, state.sessions)}m
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-2">
        {rows.map((r) => (
          <div
            key={r.exId}
            onClick={() => navigate(`/exercise/${r.exId}`)}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex-1">
              <div className="text-sm font-semibold">{r.name}</div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{r.target}</div>
            </div>
            <Sparkline series={r.spark} />
          </div>
        ))}
      </div>

      <ConfirmSheet
        open={conflict}
        title="A workout is already in progress"
        body="Starting this routine will discard the workout you're currently running."
        confirmLabel="Discard & start new"
        danger
        onCancel={() => setConflict(false)}
        onConfirm={discardAndStart}
      />
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="tabular-nums text-lg font-bold">{value}</div>
      <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}
