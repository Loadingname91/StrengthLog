import { useEffect, useRef, useState } from 'react'
import { pushModal, popModal } from '../lib/modalStack'

const HOLD_DURATION_MS = 1500

export default function ConfirmSheet({ open, title, body, confirmLabel = 'Confirm', danger = false, holdToConfirm = false, onConfirm, onCancel }) {
  const [holding, setHolding] = useState(false)
  const [holdPct, setHoldPct] = useState(0)
  const holdTimeoutRef = useRef(null)

  useEffect(() => {
    return () => clearTimeout(holdTimeoutRef.current)
  }, [])

  useEffect(() => {
    function abortHold() {
      clearTimeout(holdTimeoutRef.current)
      setHolding(false)
      setHoldPct(0)
    }
    document.addEventListener('visibilitychange', abortHold)
    window.addEventListener('blur', abortHold)
    return () => {
      document.removeEventListener('visibilitychange', abortHold)
      window.removeEventListener('blur', abortHold)
    }
  }, [])

  // Reset stale hold state from a previous open/close cycle — this instance
  // persists across opens (Settings.jsx never unmounts it), so a completed
  // or aborted hold from last time must not carry into the next open.
  useEffect(() => {
    if (open) {
      setHolding(false)
      setHoldPct(0)
    }
  }, [open])

  // Register with the shared modal stack while open so the Android hardware
  // back button dismisses this sheet instead of falling through to route
  // navigation (see src/lib/modalStack.js and App.jsx's useAndroidBackButton).
  useEffect(() => {
    if (!open) return
    const handle = pushModal(onCancel)
    return () => popModal(handle)
  }, [open, onCancel])

  function startHold() {
    setHolding(true)
    setHoldPct(100)
    holdTimeoutRef.current = setTimeout(() => onConfirm(), HOLD_DURATION_MS)
  }

  function cancelHold() {
    clearTimeout(holdTimeoutRef.current)
    setHolding(false)
    setHoldPct(0)
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        className="fade-in mx-auto w-full max-w-[480px] rounded-t-[24px] p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
        style={{ background: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-serif text-lg font-semibold">{title}</div>
        {body && <div className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{body}</div>}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl border py-3 text-sm font-semibold"
            style={{ borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
          {holdToConfirm ? (
            <button
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onContextMenu={(e) => e.preventDefault()}
              className="relative flex-1 overflow-hidden rounded-2xl py-3 text-sm font-semibold text-white"
              style={{ background: 'var(--danger)', touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
            >
              <div
                className="absolute inset-y-0 left-0 pointer-events-none"
                style={{ width: holdPct + '%', background: 'rgba(255,255,255,0.25)', transition: holding ? `width ${HOLD_DURATION_MS}ms linear` : 'width 150ms ease-out' }}
              />
              <span className="relative z-10">{confirmLabel}</span>
            </button>
          ) : (
            <button
              onClick={onConfirm}
              className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white"
              style={{ background: danger ? 'var(--danger)' : 'var(--accent)' }}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
