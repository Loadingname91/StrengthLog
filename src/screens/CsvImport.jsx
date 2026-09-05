import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import { BackIcon, UploadIcon } from '../components/Icons'
import { parseCSV, guessMapping, IMPORT_FIELDS } from '../lib/csv'
import { buildCandidates, detectUnit, finalizeImport } from '../lib/csvImport'

const SAMPLE_CSV = `exercise_title,workout_date,set_index,weight_kg,reps,rpe
Bench Press,2026-08-04,1,60,8,8
Bench Press,2026-08-04,2,60,7,9
Bench Press,2026-08-04,3,,6,9
Barbell Row,2026-08-04,1,50,10,7
Overhead Press,2026-08-06,1,40,8,8
Overhead Press,2026-08-06,2,40,8,8
Bulgarian Split Squat,2026-08-06,1,16,12,7
`

export default function CsvImport() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState(0)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState([])
  const [unit, setUnit] = useState(null)
  const [includeFlagged, setIncludeFlagged] = useState(false)
  const [result, setResult] = useState(null)

  const candidates = useMemo(() => (rows.length ? buildCandidates(headers, rows, mapping, state.customExercises) : []), [headers, rows, mapping, state.customExercises])
  const flaggedCount = candidates.filter((c) => c.flagged).length

  function loadCSV(text) {
    const { headers: h, rows: r } = parseCSV(text)
    setHeaders(h)
    setRows(r)
    setMapping(guessMapping(h))
    setStep(1)
  }

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => loadCSV(String(reader.result))
    reader.readAsText(file)
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

  function finish(chosenUnit) {
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

  const stepLabels = ['Select file', 'Map columns', 'Preview', 'Units', 'Done']
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
            onClick={() => loadCSV(SAMPLE_CSV)}
            className="mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Use sample export.csv
          </button>
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
                {IMPORT_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          ))}
          <button onClick={goPreview} className="mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Continue</button>
        </div>
      )}

      {step === 2 && (
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

      {step === 3 && (
        <div className="px-6 text-center">
          <div className="mb-3.5 text-[13px]" style={{ color: 'var(--muted)' }}>Units weren't detected — confirm for this import</div>
          <div className="flex justify-center gap-2.5">
            <button onClick={() => finish('kg')} className="rounded-xl border px-7 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>kg</button>
            <button onClick={() => finish('lb')} className="rounded-xl border px-7 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>lb</button>
          </div>
        </div>
      )}

      {step === 4 && result && (
        <div className="px-6 text-center">
          <div className="text-4xl">✓</div>
          <div className="font-serif mt-1.5 text-lg font-semibold">Import complete</div>
          <div className="mt-1.5 text-[13px]" style={{ color: 'var(--muted)' }}>
            {result.importedSets} sets imported across {result.sessions.length} session{result.sessions.length === 1 ? '' : 's'} · {result.skipped} rows skipped
          </div>
          <button onClick={() => navigate('/settings')} className="mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>Done</button>
        </div>
      )}
    </div>
  )
}
