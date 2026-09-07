import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import SegmentedControl from '../components/SegmentedControl'
import { BackIcon, UploadIcon, DownloadIcon } from '../components/Icons'
import { parseCSV, guessMapping, guessRoutineMapping, IMPORT_FIELDS, ROUTINE_IMPORT_FIELDS, downloadTextFile } from '../lib/csv'
import { buildCandidates, detectUnit, finalizeImport } from '../lib/csvImport'
import { buildRoutineCandidates, finalizeRoutineImport } from '../lib/routineCsvImport'

const SAMPLE_CSV = `exercise_title,workout_date,set_index,weight_kg,reps,rpe
Bench Press,2026-08-04,1,60,8,8
Bench Press,2026-08-04,2,60,7,9
Bench Press,2026-08-04,3,,6,9
Barbell Row,2026-08-04,1,50,10,7
Overhead Press,2026-08-06,1,40,8,8
Overhead Press,2026-08-06,2,40,8,8
Bulgarian Split Squat,2026-08-06,1,16,12,7
`

// Landmine Press isn't in the built-in catalog, so its row carries Primary
// muscle/Equipment — it becomes a custom exercise once, then gets referenced
// by id. Superset group "A" merges the two rows sharing it into one block.
const SAMPLE_ROUTINE_CSV = `Routine name,Superset group,Exercise name,Sets,Rep min,Rep max,Rest (sec),RIR,Target weight,Primary muscle,Secondary muscle,Equipment
Push Day,,Bench Press,3,8,12,90,2,,,,
Push Day,A,Incline Dumbbell Press,3,8,12,60,2,,,,
Push Day,A,Cable Fly,3,10,15,60,2,,,,
Push Day,,Landmine Press,3,8,12,90,2,,Shoulders,Triceps,Barbell
Pull Day,,Barbell Row,4,6,10,90,1,,,,
`

export default function CsvImport() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [mode, setMode] = useState('workouts') // 'workouts' | 'routines'
  const [step, setStep] = useState(0)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState([])
  const [unit, setUnit] = useState(null)
  const [includeFlagged, setIncludeFlagged] = useState(false)
  const [result, setResult] = useState(null)

  const fields = mode === 'routines' ? ROUTINE_IMPORT_FIELDS : IMPORT_FIELDS

  const candidates = useMemo(() => {
    if (!rows.length) return []
    return mode === 'routines'
      ? buildRoutineCandidates(headers, rows, mapping, state.customExercises)
      : buildCandidates(headers, rows, mapping, state.customExercises)
  }, [mode, headers, rows, mapping, state.customExercises])
  const flaggedCount = candidates.filter((c) => c.flagged).length

  const routinePreview = useMemo(
    () => (mode === 'routines' && rows.length ? finalizeRoutineImport(candidates, includeFlagged, state.routines.length) : null),
    [mode, candidates, includeFlagged, rows.length, state.routines.length],
  )

  function switchMode(next) {
    setMode(next)
    setStep(0)
    setHeaders([])
    setRows([])
    setMapping([])
    setResult(null)
  }

  function loadCSV(text) {
    const { headers: h, rows: r } = parseCSV(text)
    setHeaders(h)
    setRows(r)
    setMapping(mode === 'routines' ? guessRoutineMapping(h) : guessMapping(h))
    setStep(1)
  }

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => loadCSV(String(reader.result))
    reader.readAsText(file)
  }

  function downloadExample() {
    if (mode === 'routines') downloadTextFile('fitlog-routines-example.csv', 'text/csv', SAMPLE_ROUTINE_CSV)
    else downloadTextFile('fitlog-workouts-example.csv', 'text/csv', SAMPLE_CSV)
  }

  function goPreview() {
    setStep(2)
  }

  function goUnit() {
    const detected = detectUnit(headers, mapping)
    if (detected) {
      setUnit(detected)
      finish(detected)
    } else {
      setStep(3)
    }
  }

  function finishWorkouts(chosenUnit) {
    const u = chosenUnit || unit || 'kg'
    const outcome = finalizeImport(candidates, u, includeFlagged)
    for (const name of outcome.newExerciseNames) {
      dispatch({ type: 'ADD_CUSTOM_EXERCISE', payload: { id: `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, aliases: [], primary: 'Chest', secondary: null, equipment: 'Barbell' } })
    }
    dispatch({ type: 'IMPORT_SESSIONS', payload: outcome.sessions })
    setResult(outcome)
    setUnit(u)
    setStep(4)
  }

  function finishRoutines() {
    const outcome = finalizeRoutineImport(candidates, includeFlagged, state.routines.length)
    for (const exercise of outcome.newExercises) {
      dispatch({ type: 'ADD_CUSTOM_EXERCISE', payload: exercise })
    }
    for (const routine of outcome.routines) {
      dispatch({ type: 'ADD_ROUTINE', payload: routine })
    }
    setResult(outcome)
    setStep(4)
  }

  function finish(chosenUnit) {
    if (mode === 'routines') finishRoutines()
    else finishWorkouts(chosenUnit)
  }

  const stepLabels = mode === 'routines' ? ['Select file', 'Map columns', 'Preview', '', 'Done'] : ['Select file', 'Map columns', 'Preview', 'Units', 'Done']
  const progressPct = (step / 4) * 100

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between p-3.5">
        <button onClick={() => navigate('/settings')} className="p-1.5"><BackIcon /></button>
        <span className="text-sm font-semibold">CSV Import</span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{stepLabels[step]}</span>
      </div>
      <div className="mx-5 mb-4 h-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-alt)' }}>
        <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: 'var(--accent)' }} />
      </div>

      {step === 0 && (
        <div className="px-6 text-center">
          <div className="mb-4 flex justify-center">
            <SegmentedControl value={mode} onChange={switchMode} options={[{ value: 'workouts', label: 'Workouts' }, { value: 'routines', label: 'Routines' }]} />
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFile} />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-[18px] border-2 border-dashed p-10 text-[13px]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            <UploadIcon size={30} style={{ margin: '0 auto 10px' }} />
            Drop a .csv file, or tap to browse
          </div>
          <button
            onClick={() => loadCSV(mode === 'routines' ? SAMPLE_ROUTINE_CSV : SAMPLE_CSV)}
            className="mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Use sample {mode === 'routines' ? 'routines' : 'export'}.csv
          </button>
          <button
            onClick={downloadExample}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl border py-3 text-[13px] font-semibold"
            style={{ borderColor: 'var(--border)' }}
          >
            <DownloadIcon size={15} /> Download example CSV
          </button>
          <div className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>
            Handy for feeding the exact expected format to an LLM before generating your own file.
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="px-5">
          <div className="mb-2.5 text-xs" style={{ color: 'var(--muted)' }}>Map each detected column to a field</div>
          {headers.map((h, i) => (
            <div key={h + i} className="flex items-center justify-between border-b py-2.5" style={{ borderColor: 'var(--border)' }}>
              <span className="font-mono text-[13px]">{h}</span>
              <select
                value={mapping[i]}
                onChange={(e) => setMapping((m) => m.map((v, j) => (j === i ? e.target.value : v)))}
                className="rounded-lg border px-2 py-1 text-xs"
                style={{ borderColor: 'var(--border)' }}
              >
                {fields.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          ))}
          <button onClick={goPreview} className="mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Continue</button>
        </div>
      )}

      {step === 2 && mode === 'workouts' && (
        <div className="px-5">
          <div className="mb-2.5 text-xs" style={{ color: 'var(--muted)' }}>Preview — {flaggedCount} of {candidates.length} rows flagged</div>
          <div className="flex flex-col gap-px overflow-hidden rounded-xl" style={{ background: 'var(--border)' }}>
            {candidates.slice(0, 12).map((c) => (
              <div key={c.rowIndex} className="flex justify-between p-2.5 text-[12.5px]" style={{ background: c.flagged ? '#F6E3DC' : 'var(--surface)' }}>
                <span>{c.exerciseName || '—'}</span>
                <span className="tabular-nums">{Number.isFinite(c.weight) ? c.weight : '?'}×{Number.isFinite(c.reps) ? c.reps : '?'}</span>
                <span style={{ color: c.flagged ? 'var(--danger)' : 'var(--good)' }}>{c.flagged ? c.problems[0] : 'ok'}</span>
              </div>
            ))}
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={includeFlagged} onChange={(e) => setIncludeFlagged(e.target.checked)} />
            Include flagged rows as incomplete
          </label>
          <button onClick={goUnit} className="mt-3.5 w-full rounded-2xl py-3.5 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Continue</button>
        </div>
      )}

      {step === 2 && mode === 'routines' && routinePreview && (
        <div className="px-5">
          <div className="mb-2.5 text-xs" style={{ color: 'var(--muted)' }}>Preview — {flaggedCount} of {candidates.length} rows flagged</div>

          {routinePreview.newExercises.length > 0 && (
            <>
              <div className="mb-1.5 text-[13px] font-semibold">New exercises to create</div>
              <div className="mb-3.5 flex flex-col gap-px overflow-hidden rounded-xl" style={{ background: 'var(--border)' }}>
                {routinePreview.newExercises.map((ex) => (
                  <div key={ex.id} className="flex justify-between p-2.5 text-[12.5px]" style={{ background: 'var(--surface)' }}>
                    <span>{ex.name}</span>
                    <span style={{ color: 'var(--muted)' }}>{ex.primary}{ex.secondary ? ` / ${ex.secondary}` : ''} · {ex.equipment}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mb-1.5 text-[13px] font-semibold">Routines</div>
          <div className="flex flex-col gap-2.5">
            {routinePreview.routines.map((r) => (
              <div key={r.id} className="rounded-xl border p-2.5" style={{ borderColor: 'var(--border)' }}>
                <div className="text-[13px] font-semibold">{r.name}</div>
                {r.blocks.map((b) => (
                  <div key={b.id} className="mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>
                    {b.exerciseIds.join(' + ')} — {b.sets}×{b.repMin}-{b.repMax}, rest {b.rest}s
                  </div>
                ))}
              </div>
            ))}
            {routinePreview.routines.length === 0 && (
              <div className="text-[13px]" style={{ color: 'var(--muted)' }}>Nothing usable yet — check the flagged rows below.</div>
            )}
          </div>

          {flaggedCount > 0 && (
            <div className="mt-3.5 flex flex-col gap-px overflow-hidden rounded-xl" style={{ background: 'var(--border)' }}>
              {candidates.filter((c) => c.flagged).slice(0, 8).map((c) => (
                <div key={c.rowIndex} className="flex justify-between p-2.5 text-[12.5px]" style={{ background: '#F6E3DC' }}>
                  <span>{c.exerciseName || '—'} ({c.routineName || '—'})</span>
                  <span style={{ color: 'var(--danger)' }}>{c.problems[0]}</span>
                </div>
              ))}
            </div>
          )}

          <label className="mt-2.5 flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={includeFlagged} onChange={(e) => setIncludeFlagged(e.target.checked)} />
            Include flagged rows anyway
          </label>
          <button onClick={() => finish()} className="mt-3.5 w-full rounded-2xl py-3.5 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Import</button>
        </div>
      )}

      {step === 3 && mode === 'workouts' && (
        <div className="px-6 text-center">
          <div className="mb-3.5 text-[13px]" style={{ color: 'var(--muted)' }}>Units weren't detected — confirm for this import</div>
          <div className="flex justify-center gap-2.5">
            <button onClick={() => finish('kg')} className="rounded-xl border px-7 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>kg</button>
            <button onClick={() => finish('lb')} className="rounded-xl border px-7 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>lb</button>
          </div>
        </div>
      )}

      {step === 4 && result && mode === 'workouts' && (
        <div className="px-6 text-center">
          <div className="text-4xl">✓</div>
          <div className="font-serif mt-1.5 text-lg font-semibold">Import complete</div>
          <div className="mt-1.5 text-[13px]" style={{ color: 'var(--muted)' }}>
            {result.importedSets} sets imported across {result.sessions.length} session{result.sessions.length === 1 ? '' : 's'} · {result.skipped} rows skipped
          </div>
          <button onClick={() => navigate('/settings')} className="mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Done</button>
        </div>
      )}

      {step === 4 && result && mode === 'routines' && (
        <div className="px-6 text-center">
          <div className="text-4xl">✓</div>
          <div className="font-serif mt-1.5 text-lg font-semibold">Import complete</div>
          <div className="mt-1.5 text-[13px]" style={{ color: 'var(--muted)' }}>
            {result.routines.length} routine{result.routines.length === 1 ? '' : 's'} added, {result.newExercises.length} new exercise{result.newExercises.length === 1 ? '' : 's'} created · {result.skipped} rows skipped
          </div>
          <button onClick={() => navigate('/routines')} className="mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Done</button>
        </div>
      )}
    </div>
  )
}
