// Tracks currently-open dismissible sheets/modals so the Android hardware
// back button can close the topmost one instead of falling through to route
// navigation. A plain module-level stack (not React state) is enough here —
// ConfirmSheet instances push/pop their own cancel handler as they open/close.
let stack = []

export function pushModal(onCancel) {
  stack.push(onCancel)
  return onCancel
}

export function popModal(handle) {
  stack = stack.filter((entry) => entry !== handle)
}

// Returns true if a modal was dismissed (caller should stop further handling).
export function dismissTopModal() {
  if (stack.length === 0) return false
  const top = stack[stack.length - 1]
  top()
  return true
}
