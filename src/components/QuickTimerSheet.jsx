import { useEffect, useRef, useState } from 'react'
import { pushModal, popModal } from '../lib/modalStack'
import SegmentedControl from './SegmentedControl'
import TimerRing from './TimerRing'
import { beep } from '../lib/beep'
import { fmtElapsed } from '../lib/format'

// A countdown-from-preset or free count-up stopwatch for timed work (a
// plank, a farmer's carry, a dead hang) that weight×reps doesn't fit.
// `now` is passed down from ActiveWorkout's own 1Hz tick rather than
// starting a second interval here — this component derives everything
// from absolute epoch timestamps (deadlineMs/startedAtMs), never a
// decrementing counter, so backgrounding and returning still shows the
// right value once `now` catches up.
export default function QuickTimerSheet({ exerciseName, presets, now, onClose, onLog, onSavePreset }) {
  const [mode, setMode] = useState('down')
  const [presetSec, setPresetSec] = useState(presets[0] || 60)
  const [deadlineMs, setDeadlineMs] = useState(null)
  const [startedAtMs, setStartedAtMs] = useState(null)
  const [savePreset, setSavePreset] = useState(false)
  const dingPlayedFor = useRef(null)

  useEffect(() => {
    const handle = pushModal(onClose)
    return () => popModal(handle)
  }, [onClose])

  // Keyed on the deadline itself (not a boolean), same as the rest timer's
  // own ding guard — restarting the countdown re-arms it.
  useEffect(() => {
    if (mode !== 'down' || deadlineMs == null) { dingPlayedFor.current = null; return }
    if (now >= deadlineMs && dingPlayedFor.current !== deadlineMs) {
      dingPlayedFor.current = deadlineMs
      beep()
      if (navigator.vibrate) navigator.vibrate(200)
    }
  }, [now, deadlineMs, mode])

  const running = mode === 'down' ? deadlineMs != null : startedAtMs != null
  const remaining = mode === 'down' && deadlineMs != null ? Math.max(0, Math.ceil((deadlineMs - now) / 1000)) : 0
  const elapsedUp = mode === 'up' && startedAtMs != null ? Math.max(0, Math.floor((now - startedAtMs) / 1000)) : 0
  // For a countdown, "how long did the effort actually take" is what's
  // elapsed so far — equal to presetSec once it reaches zero, but also
  // correct if the user logs before it finishes.
  const loggedSeconds = mode === 'down' ? presetSec - remaining : elapsedUp

  function start() {
    if (mode === 'down') setDeadlineMs(Date.now() + presetSec * 1000)
    else setStartedAtMs(Date.now())
  }

  function logAndClose() {
    if (loggedSeconds <= 0) return
    onLog(loggedSeconds)
    if (savePreset) onSavePreset(loggedSeconds)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="fade-in mx-auto w-full max-w-[480px] rounded-t-[24px] p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
        style={{ background: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-serif truncate text-lg font-semibold">Quick timer{exerciseName ? ` — ${exerciseName}` : ''}</div>
          <SegmentedControl
            value={mode}
            onChange={(v) => { setMode(v); setDeadlineMs(null); setStartedAtMs(null) }}
            options={[{ value: 'down', label: 'Countdown' }, { value: 'up', label: 'Stopwatch' }]}
          />
        </div>

        {mode === 'down' && !running && (
          <>
            {presets.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {presets.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPresetSec(s)}
                    className="rounded-full border px-3 py-1.5 text-sm font-semibold"
                    style={{
                      borderColor: presetSec === s ? 'var(--accent)' : 'var(--border)',
                      background: presetSec === s ? 'var(--accent-light)' : 'transparent',
                      color: presetSec === s ? 'var(--accent-dark)' : 'var(--text)',
                    }}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                value={presetSec}
                onChange={(e) => setPresetSec(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 rounded-xl border p-2.5 text-center text-lg font-semibold"
                style={{ borderColor: 'var(--border)' }}
              />
              <span className="text-sm" style={{ color: 'var(--muted)' }}>seconds</span>
            </div>
          </>
        )}

        <div className="mt-5 flex flex-col items-center gap-3">
          {running && mode === 'down' && <TimerRing remaining={remaining} total={presetSec} size={96} />}
          {running && mode === 'up' && <div className="tabular-nums text-4xl font-bold">{fmtElapsed(elapsedUp)}</div>}

          {!running ? (
            <button onClick={start} className="w-full rounded-2xl py-3 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
              Start
            </button>
          ) : (
            <>
              <button onClick={logAndClose} className="w-full rounded-2xl py-3 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
                Log {loggedSeconds}s
              </button>
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={savePreset} onChange={(e) => setSavePreset(e.target.checked)} className="h-4 w-4" />
                Save as a preset for this exercise
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
