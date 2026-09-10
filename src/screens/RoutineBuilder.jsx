import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import ExerciseLibraryPicker from './ExerciseLibrary'
import { BackIcon, GripIcon, ClockIcon } from '../components/Icons'
import { exerciseById } from '../lib/exercises'
import { blockTarget } from '../lib/format'
import { uid } from '../lib/id'
import { pushModal, popModal } from '../lib/modalStack'
import { backfillSequence, sequenceSetCount, sequenceRestTotal, normalizeBlock } from '../lib/blocks'

export default function RoutineBuilder() {
  const { id } = useParams()
  const { state, dispatch, exercises } = useStore()
  const navigate = useNavigate()
  const editing = state.routines.find((r) => r.id === id)

  const [name, setName] = useState(editing?.name || '')
  const [position, setPosition] = useState(editing?.position || `Session ${state.routines.length + 1} of ${state.routines.length + 1}`)
  const [blocks, setBlocks] = useState(editing?.blocks || [])
  const [selectMode, setSelectMode] = useState(false)
  const [checked, setChecked] = useState(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [dragY, setDragY] = useState(0)
  const [blockMenuFor, setBlockMenuFor] = useState(null)
  const rowRefs = useRef({})
  const dragInfo = useRef(null)
  const suppressClickRef = useRef(false)

  // Android hardware back dismisses the open block menu instead of
  // navigating away, matching ConfirmSheet's modal-stack behavior.
  useEffect(() => {
    if (!blockMenuFor) return
    const handle = pushModal(() => setBlockMenuFor(null))
    return () => popModal(handle)
  }, [blockMenuFor])

  // Abort an in-progress drag if the app is backgrounded mid-gesture — no
  // pointerup/pointercancel fires in that case, which would otherwise leave
  // dragId/dragY stuck until the next unrelated pointer event (same class of
  // interrupted-gesture bug as ConfirmSheet's hold-to-confirm CR-01 fix).
  useEffect(() => {
    function abortDrag() {
      if (!dragInfo.current) return
      dragInfo.current = null
      setDragId(null)
      setDragY(0)
    }
    document.addEventListener('visibilitychange', abortDrag)
    window.addEventListener('blur', abortDrag)
    return () => {
      document.removeEventListener('visibilitychange', abortDrag)
      window.removeEventListener('blur', abortDrag)
    }
  }, [])

  const checkedIndices = useMemo(() => [...checked].sort((a, b) => a - b), [checked])
  const canGroup = useMemo(() => {
    if (checkedIndices.length < 2) return false
    return checkedIndices.every((i) => blocks[i]?.type === 'single')
  }, [checkedIndices, blocks])

  function toggleChecked(i) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function groupSuperset() {
    const [first] = checkedIndices
    const exercises = checkedIndices.map((i) => {
      const b = backfillSequence(blocks[i])
      return {
        exerciseId: b.exerciseIds[0],
        repMin: b.repMin,
        repMax: b.repMax,
        rir: b.rir,
        targetWeight: b.targetWeight ?? null,
        sequence: b.sequence.map((step) => (step.type === 'round' ? { type: 'set' } : step)),
      }
    })
    const merged = {
      id: uid('block'),
      type: 'superset',
      exerciseIds: exercises.map((e) => e.exerciseId),
      exercises,
    }
    const next = blocks.filter((_, i) => !checkedIndices.includes(i))
    const insertAt = blocks.slice(0, first).filter((_, i) => !checkedIndices.includes(i)).length
    next.splice(insertAt, 0, merged)
    setBlocks(next)
    setChecked(new Set())
    setSelectMode(false)
  }

  function deleteSelected() {
    setBlocks((prev) => prev.filter((_, i) => !checked.has(i)))
    setChecked(new Set())
    setSelectMode(false)
  }

  function ungroup(blockId) {
    setBlocks((prev) =>
      prev.flatMap((b) => {
        if (b.id !== blockId) return [b]
        if (b.exercises && b.exercises.length > 0) {
          return b.exercises.map((ex) => {
            const exWithSeq = backfillSequence(ex)
            return {
              id: uid('block'),
              type: 'single',
              exerciseIds: [ex.exerciseId],
              repMin: ex.repMin,
              repMax: ex.repMax,
              rir: ex.rir,
              targetWeight: ex.targetWeight ?? null,
              sequence: exWithSeq.sequence.map((step) => (step.type === 'round' ? { type: 'set' } : step)),
            }
          })
        }
        const bb = backfillSequence(b)
        const singleSequence = bb.sequence.map((step) => (step.type === 'round' ? { type: 'set' } : step))
        return b.exerciseIds.map((exId) => ({ ...bb, id: uid('block'), type: 'single', exerciseIds: [exId], sequence: singleSequence }))
      })
    )
  }

  function removeBlock(blockId) {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
  }

  function handleGripPointerDown(e, block, index) {
    if (selectMode) return
    e.preventDefault()
    e.stopPropagation()
    const el = rowRefs.current[block.id]
    if (!el) return
    const height = el.getBoundingClientRect().height + 8
    dragInfo.current = { id: block.id, pointerId: e.pointerId, startY: e.clientY, startIndex: index, currentIndex: index, height, el }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    if (navigator.vibrate) navigator.vibrate(10)
    setDragId(block.id)
    setDragY(0)
  }

  function handleGripPointerMove(e) {
    const info = dragInfo.current
    if (!info || info.pointerId !== e.pointerId) return
    e.preventDefault()
    const delta = e.clientY - info.startY
    const shift = Math.round(delta / info.height)
    const targetIndex = Math.min(blocks.length - 1, Math.max(0, info.startIndex + shift))
    // Compensate for the row's already-applied DOM shift so the transform
    // only carries the leftover distance to the finger, keeping it snapped
    // under the pointer instead of jumping on every swap.
    setDragY(delta - (targetIndex - info.startIndex) * info.height)
    if (targetIndex !== info.currentIndex) {
      setBlocks((prev) => {
        const next = [...prev]
        const [moved] = next.splice(info.currentIndex, 1)
        next.splice(targetIndex, 0, moved)
        return next
      })
      info.currentIndex = targetIndex
    }
  }

  function handleGripPointerUp() {
    const info = dragInfo.current
    if (!info) return
    suppressClickRef.current = true
    setTimeout(() => { suppressClickRef.current = false }, 300)
    dragInfo.current = null
    setDragId(null)
    setDragY(0)
  }

  function addExercise(exerciseId) {
    setPickerOpen(false)
    const seed = backfillSequence({ type: 'single', sets: 3, rest: state.settings.restDefault })
    setEditingBlock({ id: uid('block'), type: 'single', exerciseIds: [exerciseId], sequence: seed.sequence, repMin: 8, repMax: 12, rir: 2, targetWeight: null, isNew: true })
  }

  function saveBlockEdit(patch) {
    setBlocks((prev) => {
      const exists = prev.some((b) => b.id === editingBlock.id)
      if (exists) return prev.map((b) => (b.id === editingBlock.id ? { ...b, ...patch } : b))
      return [...prev, { ...editingBlock, ...patch }]
    })
    setEditingBlock(null)
  }

  function save() {
    const payload = { name: name.trim(), position: position.trim(), blocks }
    if (editing) dispatch({ type: 'UPDATE_ROUTINE', payload: { id: editing.id, patch: payload } })
    else dispatch({ type: 'ADD_ROUTINE', payload })
    navigate('/routines')
  }

  const canSave = name.trim().length > 0 && blocks.length > 0

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between p-3.5">
        <button onClick={() => navigate('/routines')} className="p-1.5"><BackIcon /></button>
        <span className="text-[15px] font-semibold">{editing ? 'Edit Routine' : 'New Routine'}</span>
        <button
          disabled={!canSave}
          onClick={save}
          className="rounded-[10px] px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          Save
        </button>
      </div>

      <div className="flex flex-col gap-2.5 px-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Routine name" className="rounded-xl border p-2.5 text-[15px] font-semibold" style={{ borderColor: 'var(--border)' }} />
        <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Rotation position (e.g. Session 1 of 3)" className="rounded-xl border p-2.5 text-[13px]" style={{ borderColor: 'var(--border)' }} />
      </div>

      <div className="flex items-center justify-between px-5 pt-5">
        <span className="text-[13px] font-semibold">Exercises</span>
        <button
          onClick={() => { setSelectMode(!selectMode); setChecked(new Set()) }}
          className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--accent-dark)' }}
        >
          {selectMode ? 'Done' : 'Select'}
        </button>
      </div>

      <div className="flex flex-col gap-2 px-5 pt-2.5">
        {blocks.map((block, i) => (
          <BlockRow
            key={block.id}
            setRowRef={(el) => { rowRefs.current[block.id] = el }}
            block={block}
            selectMode={selectMode}
            checked={checked.has(i)}
            dragging={dragId === block.id}
            dragY={dragId === block.id ? dragY : 0}
            onGripPointerDown={(e) => handleGripPointerDown(e, block, i)}
            onGripPointerMove={handleGripPointerMove}
            onGripPointerUp={handleGripPointerUp}
            onToggle={() => toggleChecked(i)}
            onEdit={() => { if (suppressClickRef.current) return; setEditingBlock(block) }}
            onUngroup={() => ungroup(block.id)}
            onRemove={() => removeBlock(block.id)}
            menuOpen={blockMenuFor === block.id}
            onToggleMenu={() => setBlockMenuFor(blockMenuFor === block.id ? null : block.id)}
            onCloseMenu={() => setBlockMenuFor(null)}
          />
        ))}

        {selectMode && checkedIndices.length > 0 && (
          <div className="flex gap-2">
            {canGroup && (
              <button
                onClick={groupSuperset}
                className="flex-1 rounded-xl border p-2.5 text-[13px] font-semibold"
                style={{ borderColor: 'var(--accent)', background: 'var(--accent-light)', color: 'var(--accent-dark)' }}
              >
                Group ({checkedIndices.length})
              </button>
            )}
            <button
              onClick={deleteSelected}
              className="flex-1 rounded-xl border p-2.5 text-[13px] font-semibold"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              Delete ({checkedIndices.length})
            </button>
          </div>
        )}

        <button
          onClick={() => setPickerOpen(true)}
          className="rounded-2xl border border-dashed p-3 text-[13px] font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--accent-dark)' }}
        >
          + Add Exercise
        </button>
      </div>

      {pickerOpen && <ExerciseLibraryPicker onPick={addExercise} onClose={() => setPickerOpen(false)} />}
      {editingBlock && (
        <BlockEditSheet
          block={editingBlock}
          restDefault={state.settings.restDefault}
          exercises={exercises}
          onCancel={() => setEditingBlock(null)}
          onSave={saveBlockEdit}
        />
      )}
    </div>
  )
}

function BlockRow({
  block, selectMode, checked, dragging, dragY,
  setRowRef, onGripPointerDown, onGripPointerMove, onGripPointerUp,
  onToggle, onEdit, onUngroup, onRemove,
  menuOpen, onToggleMenu, onCloseMenu,
}) {
  const { exercises } = useStore()
  const names = block.exerciseIds.map((id) => exerciseById(id, exercises)?.name || id).join(' + ')
  return (
    <div
      ref={setRowRef}
      className="relative flex items-center gap-2.5 rounded-[14px] border p-3"
      style={{
        background: 'var(--surface)',
        borderColor: block.type === 'superset' ? 'var(--accent)' : 'var(--border)',
        transform: dragging ? `translateY(${dragY}px) scale(1.02)` : undefined,
        boxShadow: dragging ? '0 8px 20px rgba(0,0,0,0.18)' : undefined,
        zIndex: dragging ? 20 : undefined,
        opacity: dragging ? 0.96 : 1,
        transition: dragging ? 'none' : 'transform 120ms ease',
        touchAction: dragging ? 'none' : undefined,
      }}
    >
      {selectMode && (
        <button onClick={onToggle} className="h-5 w-5 shrink-0 rounded-md border" style={{ borderColor: 'var(--border)', background: checked ? 'var(--accent)' : 'transparent' }} />
      )}
      {!selectMode ? (
        <button
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerUp}
          onPointerCancel={onGripPointerUp}
          className="shrink-0 cursor-grab touch-none p-1 active:cursor-grabbing"
          style={{ color: 'var(--muted)', touchAction: 'none' }}
          aria-label="Drag to reorder"
        >
          <GripIcon size={14} />
        </button>
      ) : (
        <GripIcon size={14} style={{ color: 'var(--muted)' }} className="shrink-0" />
      )}
      <div onClick={() => !selectMode && onEdit()} className="min-w-0 flex-1 cursor-pointer">
        <div className="text-sm font-semibold">{names}</div>
        {block.type === 'superset' && block.exercises ? (
          <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--muted)' }}>
            {block.exercises.map((e) => `${sequenceSetCount(backfillSequence(e).sequence)}× ${blockTarget(e)}`).join(' + ')}
          </div>
        ) : (
          <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--muted)' }}>
            {blockTarget(block)} reps · {sequenceRestTotal(backfillSequence(block).sequence)}s rest{block.rir != null ? ` · ${block.rir} RIR` : ''}
          </div>
        )}
      </div>
      {block.type === 'superset' && (
        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>SUPERSET</span>
      )}
      {!selectMode && (
        <button onClick={onToggleMenu} className="px-1 text-lg" style={{ color: 'var(--muted)' }}>⋮</button>
      )}
      {menuOpen && (
        <>
        <div className="fixed inset-0 z-[5]" onClick={onCloseMenu} />
        <div className="absolute right-2 top-11 z-10 flex flex-col overflow-hidden rounded-xl border shadow-lg" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button onClick={() => { onEdit(); onCloseMenu() }} className="px-4 py-2 text-left text-sm">Edit</button>
          {block.type === 'superset' && <button onClick={() => { onUngroup(); onCloseMenu() }} className="px-4 py-2 text-left text-sm">Ungroup</button>}
          <button onClick={() => { onRemove(); onCloseMenu() }} className="px-4 py-2 text-left text-sm" style={{ color: 'var(--danger)' }}>Remove</button>
        </div>
        </>
      )}
    </div>
  )
}

export function BlockEditSheet({ block, restDefault, onCancel, onSave, exercises }) {
  const isSuperset = block.type === 'superset'
  const normalized = normalizeBlock(block)

  const [subExercises, setSubExercises] = useState(() => {
    if (isSuperset && normalized.exercises) {
      return normalized.exercises.map((e) => ({
        ...e,
        targetWeight: e.targetWeight ?? '',
        sequence: [...backfillSequence(e).sequence],
      }))
    }
    const bSeq = backfillSequence(block)
    return [
      {
        exerciseId: block.exerciseIds[0],
        repMin: block.repMin,
        repMax: block.repMax,
        rir: block.rir,
        targetWeight: block.targetWeight ?? '',
        sequence: [...bSeq.sequence],
      },
    ]
  })

  const [activeTab, setActiveTab] = useState(0)
  const currentEx = subExercises[activeTab] || subExercises[0]

  function updateCurrentEx(patch) {
    setSubExercises((prev) =>
      prev.map((ex, idx) => (idx === activeTab ? { ...ex, ...patch } : ex))
    )
  }

  // No automatic trailing rest — a rest step is only ever added when the
  // user explicitly taps "+ Add rest" (below), so a set added at the end
  // doesn't leave a pointless rest after it.
  function addSet() {
    updateCurrentEx({
      sequence: [...currentEx.sequence, { type: 'set' }],
    })
  }

  function removeStepAt(index) {
    const next = [...currentEx.sequence]
    if (next[index].type !== 'rest' && next[index + 1]?.type === 'rest') next.splice(index, 2)
    else next.splice(index, 1)
    updateCurrentEx({ sequence: next })
  }

  function addRestAfter(index) {
    const next = [...currentEx.sequence]
    next.splice(index + 1, 0, { type: 'rest', seconds: restDefault })
    updateCurrentEx({ sequence: next })
  }

  function updateRestSeconds(index, seconds) {
    const next = currentEx.sequence.map((s, i) => (i === index ? { ...s, seconds } : s))
    updateCurrentEx({ sequence: next })
  }

  const onlyOneStepLeft = sequenceSetCount(currentEx.sequence) === 1

  let ordinal = 0
  const rows = currentEx.sequence.map((step, i) => {
    if (step.type === 'rest') {
      return (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-dashed p-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-alt)' }}>
          <ClockIcon size={14} style={{ color: 'var(--muted)' }} />
          <input
            type="number"
            value={step.seconds}
            onChange={(e) => updateRestSeconds(i, Number(e.target.value))}
            className="w-20 rounded-lg border p-1.5 text-right text-sm"
            style={{ borderColor: 'var(--border)' }}
          />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>sec</span>
          <button onClick={() => removeStepAt(i)} className="ml-auto text-lg" style={{ color: 'var(--danger)' }}>×</button>
        </div>
      )
    }
    ordinal++
    const nextIsRest = currentEx.sequence[i + 1]?.type === 'rest'
    return (
      <div key={i}>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-semibold">Set {ordinal}</span>
          {!onlyOneStepLeft && <button onClick={() => removeStepAt(i)} className="text-lg" style={{ color: 'var(--danger)' }}>×</button>}
        </div>
        {!nextIsRest && (
          <button onClick={() => addRestAfter(i)} className="text-xs font-semibold" style={{ color: 'var(--accent-dark)' }}>+ Add rest</button>
        )}
      </div>
    )
  })

  function handleSave() {
    if (isSuperset) {
      const cleaned = subExercises.map((e) => ({
        ...e,
        targetWeight: e.targetWeight === '' ? null : Number(e.targetWeight),
      }))
      onSave({
        type: 'superset',
        exerciseIds: cleaned.map((e) => e.exerciseId),
        exercises: cleaned,
      })
    } else {
      const e = subExercises[0]
      onSave({
        repMin: e.repMin,
        repMax: e.repMax,
        rir: e.rir,
        targetWeight: e.targetWeight === '' ? null : Number(e.targetWeight),
        sequence: e.sequence,
      })
    }
  }

  const headerTitle = isSuperset
    ? block.exerciseIds.map((id) => exerciseById(id, exercises)?.name || id).join(' + ')
    : exerciseById(block.exerciseIds[0], exercises)?.name || block.exerciseIds[0]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div className="fade-in mx-auto max-h-[85vh] overflow-y-auto w-full max-w-[480px] rounded-t-[24px] p-5" style={{ background: 'var(--surface)' }} onClick={(e) => e.stopPropagation()}>
        <div className="font-serif text-lg font-semibold">{headerTitle}</div>

        {isSuperset && (
          <div className="mt-3 flex gap-2 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
            {subExercises.map((ex, idx) => {
              const name = exerciseById(ex.exerciseId, exercises)?.name || ex.exerciseId
              const isActive = activeTab === idx
              const setsCount = sequenceSetCount(ex.sequence)
              return (
                <button
                  key={ex.exerciseId}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold transition"
                  style={{
                    background: isActive ? 'var(--accent)' : 'var(--surface-alt)',
                    color: isActive ? '#fff' : 'var(--muted)',
                  }}
                >
                  {name} ({setsCount} {setsCount === 1 ? 'set' : 'sets'})
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Min reps">
            <input
              type="number"
              value={currentEx.repMin}
              onChange={(e) => updateCurrentEx({ repMin: Number(e.target.value) })}
              className="w-full rounded-xl border p-2 text-sm"
              style={{ borderColor: 'var(--border)' }}
            />
          </Field>
          <Field label="Max reps">
            <input
              type="number"
              value={currentEx.repMax}
              onChange={(e) => updateCurrentEx({ repMax: Number(e.target.value) })}
              className="w-full rounded-xl border p-2 text-sm"
              style={{ borderColor: 'var(--border)' }}
            />
          </Field>
        </div>

        <Field label="Sequence">
          <div className="flex flex-col gap-1.5">{rows}</div>
          <button
            onClick={addSet}
            className="mt-1.5 w-full rounded-xl border border-dashed p-2 text-xs font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--accent-dark)' }}
          >
            + Add Set
          </button>
        </Field>

        <Field label="RIR target (optional)">
          <input
            type="number"
            value={currentEx.rir ?? ''}
            onChange={(e) => updateCurrentEx({ rir: e.target.value === '' ? null : Number(e.target.value) })}
            className="w-full rounded-xl border p-2 text-sm"
            style={{ borderColor: 'var(--border)' }}
          />
        </Field>

        <Field label="Target weight (optional)">
          <input
            type="number"
            value={currentEx.targetWeight}
            onChange={(e) => updateCurrentEx({ targetWeight: e.target.value })}
            placeholder="e.g. 60"
            className="w-full rounded-xl border p-2 text-sm"
            style={{ borderColor: 'var(--border)' }}
          />
        </Field>

        <button
          onClick={handleSave}
          className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Save {isSuperset ? 'superset' : 'exercise'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="mt-1">
      <div className="mb-1 text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>{label}</div>
      {children}
    </div>
  )
}
