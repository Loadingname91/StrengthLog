import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((message, opts = {}) => {
    clearTimeout(timerRef.current)
    setToast({ message, onUndo: opts.onUndo || null })
    timerRef.current = setTimeout(() => setToast(null), opts.duration || 4000)
  }, [])

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className="toast-in fixed bottom-24 left-1/2 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg"
          style={{ background: 'var(--text)', color: 'var(--bg)' }}
        >
          <span>{toast.message}</span>
          {toast.onUndo && (
            <button
              onClick={() => { toast.onUndo(); dismiss() }}
              className="font-semibold"
              style={{ color: 'var(--accent-dark)' }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
