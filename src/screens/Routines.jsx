import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import Card from '../components/Card'
import ConfirmSheet from '../components/ConfirmSheet'
import SegmentedControl from '../components/SegmentedControl'
import { GripIcon, ChevronRightIcon, EditIcon, TrashIcon } from '../components/Icons'
import { exerciseById } from '../lib/exercises'
import { uid } from '../lib/id'

function estimateDuration(routine) {
  const seconds = routine.blocks.reduce((sum, b) => sum + b.sets * (50 + b.rest), 0)
  return Math.round(seconds / 60)
}

export default function Routines() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [menuFor, setMenuFor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

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

      <div className="flex flex-col gap-3 px-5 pt-2">
        {ordered.map((routine, i) => {
          const exCount = routine.blocks.reduce((s, b) => s + b.exerciseIds.length, 0)
          const heat = routine.blocks.flatMap((b) => b.exerciseIds).map((id) => exerciseById(id)).filter(Boolean)
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
    </div>
  )
}
