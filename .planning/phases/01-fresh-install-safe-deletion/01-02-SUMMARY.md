---
phase: 01-fresh-install-safe-deletion
plan: 2
subsystem: ui-interaction
tags: [confirm-sheet, hold-to-confirm, safe-deletion, settings]
dependency-graph:
  requires: []
  provides:
    - "ConfirmSheet holdToConfirm prop (1500ms hold-to-fill gesture)"
  affects:
    - src/screens/Settings.jsx
tech-stack:
  added: []
  patterns:
    - "Reused ProgressBar's overflow-hidden + inline-width-transition fill technique for the hold gesture"
    - "Pointer Events (onPointerDown/Up/Leave/Cancel) instead of touch/mouse-specific handlers"
key-files:
  created: []
  modified:
    - src/components/ConfirmSheet.jsx
    - src/screens/Settings.jsx
decisions:
  - "holdToConfirm implemented as a plain boolean (no duration override param) since UI-SPEC locks 1500ms as the only supported duration this phase"
metrics:
  duration: "~15 min"
  completed: 2026-09-05
status: complete
---

# Phase 1 Plan 2: Hold-to-Confirm Delete Gesture Summary

Added an opt-in `holdToConfirm` prop to the shared `ConfirmSheet` component that swaps its confirm button from single-tap to a 1500ms press-and-hold with a linear white fill sweep, then wired it onto Settings' "Delete all data" call site only.

## What Was Built

**Task 1 — `src/components/ConfirmSheet.jsx`:** Added `holdToConfirm = false` prop. When true, the confirm button renders with `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` handlers and no `onClick` at all, so only an uninterrupted 1500ms hold can call `onConfirm`. A `setTimeout` scheduled on pointer-down calls `onConfirm()` after 1500ms unless cancelled first by a pointer-up/leave/cancel event (which clears the timeout and resets the fill via a 150ms ease-out transition) or by the component unmounting (guarded by a cleanup `useEffect`). The fill itself is an absolutely-positioned `rgba(255,255,255,0.25)` layer inside the button, width driven by local `holdPct` state and animated via inline `style` `transition` (`1500ms linear` while holding, `150ms ease-out` while cancelling) — copying `ProgressBar.jsx`'s existing width-transition technique exactly, no new CSS/keyframes. `touchAction: 'none'`, `WebkitUserSelect: 'none'`, `userSelect: 'none'`, and `onContextMenu={(e) => e.preventDefault()}` guard against Android WebView's native long-press callout interrupting the gesture. When `holdToConfirm` is falsy (the default), the confirm button renders exactly as before — `onClick={onConfirm}`, same classes/style, no wrapper/fill/pointer handlers — so `Routines.jsx` and `ActiveWorkout.jsx`'s call sites are unaffected.

**Task 2 — `src/screens/Settings.jsx`:** Added `holdToConfirm` to the "Delete all data" `ConfirmSheet` call. Every other prop (including the `onConfirm` dispatch body) is unmodified. `Routines.jsx` and `ActiveWorkout.jsx` were not touched — verified zero occurrences of `holdToConfirm` in both.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run build` — clean, no errors, after both tasks.
- `npm run lint` — clean (only pre-existing, unrelated warnings in other files: `LineChart.jsx`, `ToastContext.jsx`, `reducer.js`, `seed.js`, `Home.jsx`, `RoutineBuilder.jsx`, `StatsHub.jsx`, `ActiveWorkout.jsx` — none touched by this plan).
- `grep -c "onPointerDown={startHold}" src/components/ConfirmSheet.jsx` → 1
- `grep -c "1500ms linear" src/components/ConfirmSheet.jsx` → 1
- `grep -c "150ms ease-out" src/components/ConfirmSheet.jsx` → 1
- `grep -c "onContextMenu={(e) => e.preventDefault()}" src/components/ConfirmSheet.jsx` → 1
- `grep -c "holdToConfirm" src/screens/Settings.jsx` → 1
- `grep -q "holdToConfirm" src/screens/Routines.jsx` → not found (unaffected)
- `grep -q "holdToConfirm" src/screens/ActiveWorkout.jsx` → not found (unaffected)
- Confirmed via `grep -n "onClick"` that the hold-variant confirm button (lines 43-57 of `ConfirmSheet.jsx`) has no `onClick` handler — the pre-existing `onClick={onConfirm}` at line 60 belongs solely to the non-hold branch.
- Human verification (visual hold/cancel behavior on-device via `npm run build && npx cap sync android`) is deferred to the user per project's Android testing workflow — not executable in this environment.

## Known Stubs

None.

## Threat Flags

None — this plan's threat model items (T-01-03, T-01-04, T-01-05) are fully addressed by the implementation (no `onClick` on the hold variant, cleanup `useEffect` clearing the timeout on unmount, `touchAction`/`userSelect`/`onContextMenu` guards against native long-press interruption) and introduce no new surface beyond what the plan's threat register already accounted for.

## Self-Check: PASSED

- FOUND: src/components/ConfirmSheet.jsx (modified, holdToConfirm gesture present)
- FOUND: src/screens/Settings.jsx (modified, holdToConfirm wired)
- FOUND commit d6250e2 (Task 1: feat(01-02) add holdToConfirm hold-to-fill gesture to ConfirmSheet)
- FOUND commit 24fe172 (Task 2: feat(01-02) wire holdToConfirm onto Settings delete-all confirm sheet)
