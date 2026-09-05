import { useMemo, useState } from 'react'
import { useStore } from '../state/StoreContext'
import { BackIcon, SearchIcon } from '../components/Icons'
import { MUSCLES, EQUIPMENT } from '../lib/muscles'
import { searchExercises } from '../lib/exercises'

// Full-screen overlay used both by the Routine Builder ("+ Add Exercise")
// and — via the same component — for a future in-session swap. Not a
// router route: whatever launched it gets the picked exercise back through
// onPick, no return-value routing needed.
export default function ExerciseLibraryPicker({ onPick, onClose }) {
  const { exercises, dispatch } = useStore()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState(null)
  const [equipment, setEquipment] = useState(null)
  const [creating, setCreating] = useState(false)

  const results = useMemo(() => searchExercises(exercises, query, muscle, equipment), [exercises, query, muscle, equipment])

  function createCustom(payload) {
    dispatch({ type: 'ADD_CUSTOM_EXERCISE', payload })
    setCreating(false)
    onPick(payload.id)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[480px] overflow-auto pb-6">
        <div className="p-3.5"><button onClick={onClose} className="p-1.5"><BackIcon /></button></div>
        <div className="font-serif px-5 text-xl font-semibold">Exercise Library</div>

        <div className="px-5 pt-3">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
            <SearchIcon size={16} style={{ color: 'var(--muted)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-5 pt-2.5">
          {MUSCLES.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>{m}</Chip>
          ))}
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-5 pt-1.5">
          {EQUIPMENT.map((eq) => (
            <Chip key={eq} active={equipment === eq} onClick={() => setEquipment(equipment === eq ? null : eq)}>{eq}</Chip>
          ))}
        </div>

        <div className="flex flex-col gap-2 px-5 pt-3">
          {results.map((ex) => (
            <div
              key={ex.id}
              onClick={() => onPick(ex.id)}
              className="flex cursor-pointer items-center gap-2.5 rounded-2xl border p-2.5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: 'var(--surface-alt)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /></svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{ex.name}</div>
                <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--muted)' }}>{ex.primary} · {ex.equipment}</div>
              </div>
            </div>
          ))}
          {!results.length && <div className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>No matches.</div>}
          <button
            onClick={() => setCreating(true)}
            className="rounded-2xl border border-dashed p-3 text-[13px] font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--accent-dark)' }}
          >
            + Create custom exercise
          </button>
        </div>
      </div>

      {creating && <CreateCustomSheet onCancel={() => setCreating(false)} onCreate={createCustom} />}
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11.5px] font-semibold"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'var(--accent-light)' : 'transparent',
        color: active ? 'var(--accent-dark)' : 'var(--muted)',
      }}
    >
      {children}
    </button>
  )
}

function CreateCustomSheet({ onCancel, onCreate }) {
  const [name, setName] = useState('')
  const [primary, setPrimary] = useState(MUSCLES[0])
  const [equipment, setEquipment] = useState(EQUIPMENT[0])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div className="fade-in mx-auto w-full max-w-[480px] rounded-t-[24px] p-5" style={{ background: 'var(--surface)' }} onClick={(e) => e.stopPropagation()}>
        <div className="font-serif text-lg font-semibold">Custom exercise</div>
        <div className="mt-3 flex flex-col gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Exercise name" className="rounded-xl border p-2.5 text-sm font-semibold" style={{ borderColor: 'var(--border)' }} />
          <select value={primary} onChange={(e) => setPrimary(e.target.value)} className="rounded-xl border p-2.5 text-sm" style={{ borderColor: 'var(--border)' }}>
            {MUSCLES.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select value={equipment} onChange={(e) => setEquipment(e.target.value)} className="rounded-xl border p-2.5 text-sm" style={{ borderColor: 'var(--border)' }}>
            {EQUIPMENT.map((eq) => <option key={eq}>{eq}</option>)}
          </select>
        </div>
        <button
          disabled={!name.trim()}
          onClick={() => onCreate({ id: `custom-${Date.now()}`, name: name.trim(), aliases: [], primary, secondary: null, equipment })}
          className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          Add exercise
        </button>
      </div>
    </div>
  )
}
