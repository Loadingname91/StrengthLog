export default function ConfirmSheet({ open, title, body, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
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
          <button
            onClick={onConfirm}
            className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white"
            style={{ background: danger ? 'var(--danger)' : 'var(--accent)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
