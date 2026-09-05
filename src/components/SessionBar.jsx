import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import { ClockIcon } from './Icons'
import { fmtElapsed } from '../lib/format'

export default function SessionBar() {
  const { state } = useStore()
  const navigate = useNavigate()
  const aw = state.activeWorkout
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!aw) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [aw])

  useEffect(() => {
    if (!aw) return
    function onVisible() {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [aw])

  if (!aw) return null

  const elapsedSec = Math.floor((now - new Date(aw.startedAt).getTime()) / 1000)

  return (
    <button
      onClick={() => navigate('/workout')}
      className="fixed bottom-[70px] left-0 right-0 z-20 mx-auto flex w-full max-w-[452px] items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-left shadow-lg"
      style={{ background: 'var(--accent)', borderColor: 'var(--accent-dark)', marginLeft: '14px', marginRight: '14px' }}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
        <ClockIcon size={16} className="text-white" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">Workout in progress — {aw.routineName}</span>
      <span className="tabular-nums shrink-0 text-[13px] font-bold text-white">{fmtElapsed(elapsedSec)}</span>
    </button>
  )
}
