import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import Card from '../components/Card'
import ConfirmSheet from '../components/ConfirmSheet'
import SegmentedControl from '../components/SegmentedControl'
import WeekStrip from '../components/WeekStrip'
import { GripIcon, ChevronRightIcon, EditIcon, TrashIcon } from '../components/Icons'
import { exerciseById } from '../lib/exercises'
import { uid } from '../lib/id'
import { weekdayName } from '../lib/schedule'
import { pushModal, popModal } from '../lib/modalStack'
import { backfillSequence } from '../lib/blocks'

// 50s of work assumed per set; a round (superset) costs 50s per exercise in
// the pair, matching how set/rep totals elsewhere already scale by
// exerciseIds.length for a superset. Rest steps contribute their real duration.
function estimateDuration(routine) {
  const seconds = routine.blocks.reduce((sum, block) => {
    const b = backfillSequence(block)
    return sum + b.sequence.reduce((s, step) => {
      if (step.type === 'rest') return s + step.seconds
      return s + 50 * (b.type === 'superset' ? b.exerciseIds.length : 1)
    }, 0)
  }, 0)
  return Math.round(seconds / 60)
}

export default function Routines() {
  const { state, dispatch, exercises } = useStore()
  const navigate = useNavigate()
  const [menuFor, setMenuFor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editingSchedule, setEditingSchedule] = useState(false)

  // Android hardware back dismisses the open action menu instead of
  // navigating away, matching ConfirmSheet's modal-stack behavior.
  useEffect(() => {
    if (!menuFor) return
    const handle = pushModal(() => setMenuFor(null))
    return () => popModal(handle)
  }, [menuFor])

  const ordered = state.routineOrder.map((id) => state.routines.find((r) => r.id === id)).filter(Boolean)

  function move(id, dir) {
    const idx = state.routineOrder.indexOf(id)
    const next = idx + dir
    if (next < 0 || next >= state.routineOrder.length) return
    const order = [...state.routineOrder]
    ;[order[idx], order[next]] = [order[next], order[idx]]
    dispatch({ type: 'REORDER_ROUTINES', payload: order })
  }

  function duplicate(routine) {
    const copy = {
      ...routine,
      id: uid('routine'),
      name: `${routine.name} copy`,
      blocks: routine.blocks.map((b) => ({ ...b, id: uid('block') })),
    }
    dispatch({ type: 'ADD_ROUTINE', payload: copy })
    setMenuFor(null)
  }

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <div className="font-serif text-[22px] font-semibold">Routines</div>
        <SegmentedControl
          value={state.routineMode}
          onChange={(v) => dispatch({ type: 'SET_ROUTINE_MODE', payload: v })}
          options={[{ value: 'sequence', label: 'Sequence' }, { value: 'weekday', label: 'Weekday' }]}
        />
      </div>

      {state.routineMode === 'weekday' && (
        <div className="px-5 pb-1 pt-1">
          <WeekStrip weekdayAssignments={state.weekdayAssignments} sessions={state.sessions} routines={state.routines} />
          <button
            onClick={() => setEditingSchedule(true)}
            className="mt-2 text-xs font-semibold"
            style={{ color: 'var(--accent-dark)' }}
          >
            Edit schedule
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 px-5 pt-2">
        {ordered.map((routine, i) => {
          const exCount = routine.blocks.reduce((s, b) => s + b.exerciseIds.length, 0)
          const heat = routine.blocks.flatMap((b) => b.exerciseIds).map((id) => exerciseById(id, exercises)).filter(Boolean)
          return (
            <div key={routine.id} className="relative">
              <Card onClick={() => navigate(`/routines/${routine.id}`)} className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button disabled={i === 0} onClick={() => move(routine.id, -1)} style={{ color: 'var(--muted)', opacity: i === 0 ? 0.3 : 1 }}>▲</button>
                  <GripIcon size={16} style={{ color: 'var(--muted)' }} />
                  <button disabled={i === ordered.length - 1} onClick={() => move(routine.id, 1)} style={{ color: 'var(--muted)', opacity: i === ordered.length - 1 ? 0.3 : 1 }}>▼</button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">{routine.name}</div>
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                    {routine.position} · {exCount} exercises · ~{estimateDuration(routine)} min
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0" style={{ opacity: 0.7 }}>
                  {heat.slice(0, 4).map((ex, idx) => (
                    <div key={idx} className="h-9 w-2 rounded-full" style={{ background: 'var(--accent)', opacity: 0.3 + idx * 0.15 }} />
                  ))}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === routine.id ? null : routine.id) }} className="shrink-0 px-1 text-lg" style={{ color: 'var(--muted)' }}>
                  ⋮
                </button>
                <ChevronRightIcon size={18} style={{ color: 'var(--muted)' }} />
              </Card>

              {menuFor === routine.id && (
                <>
                <div className="fixed inset-0 z-[5]" onClick={() => setMenuFor(null)} />
                <div className="absolute right-3 top-14 z-10 flex flex-col overflow-hidden rounded-xl border shadow-lg" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <button onClick={() => { navigate(`/routines/${routine.id}/edit`); setMenuFor(null) }} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <EditIcon size={15} /> Edit
                  </button>
                  <button onClick={() => duplicate(routine)} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    Duplicate
                  </button>
                  <button onClick={() => { setDeleteTarget(routine.id); setMenuFor(null) }} className="flex items-center gap-2 px-4 py-2.5 text-sm" style={{ color: 'var(--danger)' }}>
                    <TrashIcon size={15} /> Delete
                  </button>
                </div>
                </>
              )}
            </div>
          )
        })}

        <button
          onClick={() => navigate('/routines/new')}
          className="rounded-2xl border border-dashed p-3.5 text-[13px] font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--accent-dark)' }}
        >
          + New Routine
        </button>
      </div>

      <ConfirmSheet
        open={!!deleteTarget}
        title="Delete this routine?"
        body="This removes it from your rotation. Logged workout history is kept."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { dispatch({ type: 'DELETE_ROUTINE', payload: deleteTarget }); setDeleteTarget(null) }}
      />

      {editingSchedule && <ScheduleEditSheet onClose={() => setEditingSchedule(false)} />}
    </div>
  )
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun

function ScheduleEditSheet({ onClose }) {
  const { state, dispatch } = useStore()
  const ordered = state.routineOrder.map((id) => state.routines.find((r) => r.id === id)).filter(Boolean)

  function setWeekday(routineId, weekday) {
    dispatch({ type: 'SET_WEEKDAY_ASSIGNMENT', payload: { routineId, weekday } })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="fade-in mx-auto w-full max-w-[480px] rounded-t-[24px] p-5"
        style={{ background: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-serif text-lg font-semibold">Weekly schedule</div>
        <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          Assign each routine a preferred day. Skipped days push forward automatically.
        </div>
        <div className="mt-3 flex max-h-[50vh] flex-col gap-2 overflow-auto">
          {ordered.map((routine) => (
            <div key={routine.id} className="flex items-center justify-between gap-2 rounded-xl border p-2.5" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-semibold">{routine.name}</span>
              <select
                value={state.weekdayAssignments[routine.id] ?? ''}
                onChange={(e) => setWeekday(routine.id, e.target.value === '' ? null : Number(e.target.value))}
                className="rounded-lg border px-2 py-1.5 text-xs"
                style={{ borderColor: 'var(--border)' }}
              >
                <option value="">No fixed day</option>
                {WEEKDAY_ORDER.map((d) => <option key={d} value={d}>{weekdayName(d)}</option>)}
              </select>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
          Done
        </button>
      </div>
    </div>
  )
}
