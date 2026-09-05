import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import ExerciseLibraryPicker from './ExerciseLibrary'
import { BackIcon, GripIcon } from '../components/Icons'
import { exerciseById } from '../lib/exercises'
import { blockTarget } from '../lib/format'
import { uid } from '../lib/id'
import { pushModal, popModal } from '../lib/modalStack'

export default function RoutineBuilder() {
  const { id } = useParams()
  const { state, dispatch } = useStore()
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

  const checkedIndices = useMemo(() => [...checked].sort((a, b) => a - b), [checked])
  const canGroup = useMemo(() => {
    if (checkedIndices.length < 2) return false
    if (!checkedIndices.every((i) => blocks[i]?.type === 'single')) return false
    return checkedIndices.every((v, i) => i === 0 || v === checkedIndices[i - 1] + 1)
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
    const [first, ...rest] = checkedIndices
    const merged = {
      ...blocks[first],
      type: 'superset',
      exerciseIds: checkedIndices.flatMap((i) => blocks[i].exerciseIds),
    }
    const next = blocks.filter((_, i) => !checkedIndices.includes(i))
    const insertAt = blocks.slice(0, first).filter((_, i) => !checkedIndices.includes(i)).length
    next.splice(insertAt, 0, merged)
    setBlocks(next)
    setChecked(new Set())
    setSelectMode(false)
  }

  function ungroup(blockId) {
    setBlocks((prev) =>
      prev.flatMap((b) => (b.id === blockId ? b.exerciseIds.map((exId) => ({ ...b, id: uid('block'), type: 'single', exerciseIds: [exId] })) : [b]))
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
    setEditingBlock({ id: uid('block'), type: 'single', exerciseIds: [exerciseId], sets: 3, repMin: 8, repMax: 12, rest: 90, rir: 2, targetWeight: null, isNew: true })
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

        {selectMode && canGroup && (
          <button
            onClick={groupSuperset}
            className="rounded-xl border p-2.5 text-[13px] font-semibold"
            style={{ borderColor: 'var(--accent)', background: 'var(--accent-light)', color: 'var(--accent-dark)' }}
          >
            Group as superset ({checkedIndices.length} selected)
          </button>
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
  const names = block.exerciseIds.map((id) => exerciseById(id)?.name || id).join(' + ')
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
        <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--muted)' }}>{blockTarget(block)} reps · {block.rest}s rest{block.rir != null ? ` · ${block.rir} RIR` : ''}</div>
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

function BlockEditSheet({ block, onCancel, onSave }) {
  const [sets, setSets] = useState(block.sets)
  const [repMin, setRepMin] = useState(block.repMin)
  const [repMax, setRepMax] = useState(block.repMax)
  const [rest, setRest] = useState(block.rest)
  const [rir, setRir] = useState(block.rir)
  const [targetWeight, setTargetWeight] = useState(block.targetWeight ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div className="fade-in mx-auto w-full max-w-[480px] rounded-t-[24px] p-5" style={{ background: 'var(--surface)' }} onClick={(e) => e.stopPropagation()}>
        <div className="font-serif text-lg font-semibold">{block.exerciseIds.map((id) => exerciseById(id)?.name || id).join(' + ')}</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Sets"><input type="number" value={sets} onChange={(e) => setSets(Number(e.target.value))} className="w-full rounded-xl border p-2 text-sm" style={{ borderColor: 'var(--border)' }} /></Field>
          <Field label="Rest (sec)"><input type="number" value={rest} onChange={(e) => setRest(Number(e.target.value))} className="w-full rounded-xl border p-2 text-sm" style={{ borderColor: 'var(--border)' }} /></Field>
          <Field label="Min reps"><input type="number" value={repMin} onChange={(e) => setRepMin(Number(e.target.value))} className="w-full rounded-xl border p-2 text-sm" style={{ borderColor: 'var(--border)' }} /></Field>
          <Field label="Max reps"><input type="number" value={repMax} onChange={(e) => setRepMax(Number(e.target.value))} className="w-full rounded-xl border p-2 text-sm" style={{ borderColor: 'var(--border)' }} /></Field>
        </div>
        <Field label="RIR target (optional)">
          <input type="number" value={rir ?? ''} onChange={(e) => setRir(e.target.value === '' ? null : Number(e.target.value))} className="w-full rounded-xl border p-2 text-sm" style={{ borderColor: 'var(--border)' }} />
        </Field>
        <Field label="Target weight (optional)">
          <input type="number" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="e.g. 60" className="w-full rounded-xl border p-2 text-sm" style={{ borderColor: 'var(--border)' }} />
        </Field>
        <button
          onClick={() => onSave({ sets, repMin, repMax, rest, rir, targetWeight: targetWeight === '' ? null : Number(targetWeight) })}
          className="mt-2 w-full rounded-2xl py-3 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Save exercise
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
