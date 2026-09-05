---
phase: 01-fresh-install-safe-deletion
reviewed: 2026-09-05T08:40:15Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/state/StoreContext.jsx
  - src/components/ConfirmSheet.jsx
  - src/screens/Settings.jsx
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-05T08:40:15Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

This phase (1) replaces the demo/seed-data initial state with a genuinely empty fresh-install state in `StoreContext.jsx`, and (2) adds a hold-to-confirm gesture to `ConfirmSheet.jsx`, wired up for the "Delete all data" flow in `Settings.jsx`. The empty-state change is mostly clean, but it leaves one vestige of the old demo persona (`user: { name: 'Marcus' }`) that undercuts the "fresh install" goal. The hold-to-confirm gesture — whose entire purpose is to prevent an accidental irreversible deletion — has a real gap: nothing resets the in-flight hold if the gesture is interrupted by something other than a pointer event (app backgrounded, OS interruption), and the confirmation copy overstates what survives the delete (custom exercises are actually wiped despite the dialog promising the "exercise library" is kept, per `reducer.js`'s `DELETE_ALL_DATA` case). Given this app's stated core value — reliable data handling that must never surprise the user, especially around backgrounding — these are treated as blockers.

## Critical Issues

### CR-01: Hold-to-confirm gesture has no defense against interrupted holds (backgrounding / OS interruption)

**File:** `src/components/ConfirmSheet.jsx:8-22`
**Issue:** `startHold` schedules `onConfirm()` via a raw `setTimeout(..., 1500)`. The only way to cancel it is `onPointerUp` / `onPointerLeave` / `onPointerCancel` firing on the button itself. If the interaction is interrupted by something that does not reliably deliver one of those events to this exact element — the app being backgrounded mid-press (task switch, incoming call/notification overlay, screen lock), a WebView losing/never dispatching `pointercancel` on suspend (a known cross-browser inconsistency) — the timer keeps running in the background and will still fire `onConfirm()` (dispatching `DELETE_ALL_DATA`) once the app resumes, even though the user is no longer touching the button and never completed the 1.5s hold. There is also no `visibilitychange`/`blur` listener as a defense-in-depth backstop. This directly contradicts this project's stated core value that user actions "must be fast, reliable, and never lose data, even if the user backgrounds the app" — here backgrounding can cause an unintended irreversible deletion instead.
**Fix:**
```jsx
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
```

### CR-02: "Delete all data" confirmation promises the exercise library is kept, but custom exercises are wiped

**File:** `src/screens/Settings.jsx:94` (dialog copy) vs. `src/state/reducer.js:252-261` (`DELETE_ALL_DATA`)
**Issue:** The confirmation sheet tells the user: *"This permanently removes every workout, measurement, and goal on this device. Routines and the exercise library are kept."* However, the reducer's `DELETE_ALL_DATA` case also clears `customExercises: []` and `exerciseNotes: {}` — i.e., any exercise the user added to their library, and any notes attached to exercises, are permanently destroyed despite the dialog's explicit assurance that the "exercise library" survives. Because this is a hold-to-confirm irreversible action with no undo, a user relying on the stated behavior will lose custom exercise data without any warning, which is precisely the kind of silent, unrecoverable data loss this app is meant to guard against.
**Fix:** Either exclude `customExercises`/`exerciseNotes` from the `DELETE_ALL_DATA` reducer case (matching the dialog's promise), or correct the dialog copy to accurately disclose that custom exercises/notes are also deleted:
```js
case 'DELETE_ALL_DATA':
  return {
    ...state,
    sessions: [],
    measurements: [],
    activeWorkout: null,
    goals: [],
    // keep customExercises / exerciseNotes to match the confirmation copy
  }
```

## Warnings

### WR-01: Hold progress state is never reset after a successful confirm, causing stale "pre-filled" UI on next open

**File:** `src/components/ConfirmSheet.jsx:12-22`, used from `src/screens/Settings.jsx:91-100`
**Issue:** `Settings.jsx` always renders `<ConfirmSheet open={confirmDelete} .../>` (never conditionally, no `key`), so the same `ConfirmSheet` instance persists across opens/closes — only the internal `if (!open) return null` toggles visibility. When a hold completes successfully, `onConfirm()` fires from the `setTimeout` inside `startHold`, but nothing calls `cancelHold()` to reset `holding`/`holdPct`. If the user (or a future caller) reopens the same sheet later, the fill bar renders already at `width: 100%` with `holding: true` baked in from the previous session, showing a pre-filled/"already engaged" delete button before the user has touched it.
**Fix:** Reset internal state when `open` transitions to `true`, or explicitly reset at the end of the timeout callback:
```jsx
useEffect(() => {
  if (open) { setHolding(false); setHoldPct(0) }
}, [open])
```

### WR-02: Fresh install still hardcodes a demo persona name

**File:** `src/state/StoreContext.jsx:19`
**Issue:** `buildInitialState()` was rewritten in this phase specifically to stop seeding demo data (`buildSeed()` was removed in favor of empty arrays), but `user: { name: 'Marcus' }` was left behind. `Home.jsx` reads `state.user.name` directly for its greeting header, so every brand-new install greets the user with a stranger's name ("Marcus") with no onboarding step to change it — inconsistent with this phase's "fresh install empty state" goal.
**Fix:** Default to an empty/generic value (e.g., `name: ''` with a fallback UI treatment, or prompt for a name on first run) rather than a leftover demo persona.

### WR-03: `DELETE_ALL_DATA` doesn't clear `lastFinishedSession`, leaving a dangling reference to deleted data

**File:** `src/screens/Settings.jsx:99` (dispatches `DELETE_ALL_DATA`) vs. `src/state/reducer.js:252-261`
**Issue:** The confirmation text says this "permanently removes every workout ... on this device," but `state.lastFinishedSession` (consumed directly by `WorkoutSummary.jsx`) is not cleared by `DELETE_ALL_DATA`. If a user finishes a workout and then deletes all data without navigating away from the summary flow (e.g., returns to `/workout-summary` via back/forward navigation), the screen can still render a "finished session" that no longer exists in `state.sessions`.
**Fix:** Add `lastFinishedSession: null` to the `DELETE_ALL_DATA` case in `reducer.js`.

### WR-04: Android back button has no awareness of the open destructive confirmation sheet

**File:** `src/screens/Settings.jsx:91-100` (uses `ConfirmSheet`), back-button handling in `src/App.jsx:25-43` (not in review scope but directly interacts with this flow)
**Issue:** `useAndroidBackButton` only ever calls `navigate(-1)`/`navigate('/')`/`exitApp()` — it has no concept of "an open modal should be dismissed first." Pressing the hardware back button while the "Delete all data" sheet is open does not call the sheet's `onCancel`; it instead performs route navigation (which happens to unmount `Settings` and incidentally close the sheet, but does so via full navigation rather than a clean cancel). This is a pre-existing architectural gap, but this phase specifically hardens the safety of this exact destructive-action flow, so the back button's inconsistent handling of the open confirm sheet remains a real gap in that hardening.
**Fix:** Track open modal/sheet state (e.g., a shared "top sheet" ref or a lightweight modal stack) and have the back-button handler call the active sheet's `onCancel` before falling back to route navigation.

### WR-05: Hold duration hardcoded in two independent places (JS timer vs. CSS transition)

**File:** `src/components/ConfirmSheet.jsx:15,54`
**Issue:** `1500` appears both as the `setTimeout` delay (`src/components/ConfirmSheet.jsx:15`) and as the CSS transition duration string `'width 1500ms linear'` (`src/components/ConfirmSheet.jsx:54`). These must stay in sync for the visual fill to match the actual trigger time, but there is no shared constant enforcing that — a future edit to one (e.g., tuning the gesture length) will silently desync the visual feedback from the actual delete trigger, misleading the user about how long they need to hold.
**Fix:**
```jsx
const HOLD_DURATION_MS = 1500
// ...
holdTimeoutRef.current = setTimeout(() => onConfirm(), HOLD_DURATION_MS)
// ...
transition: holding ? `width ${HOLD_DURATION_MS}ms linear` : 'width 150ms ease-out'
```

## Info

### IN-01: Hold-to-confirm delete action is only reachable via pointer events

**File:** `src/components/ConfirmSheet.jsx:42-57`
**Issue:** The destructive confirm button only wires `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel`. There is no keyboard equivalent (e.g., `onKeyDown`/`onKeyUp` for Space/Enter), so keyboard-only or switch-control navigation cannot complete (or even partially trigger) this action.
**Fix:** Add keyboard handlers that mirror the pointer hold behavior for accessibility parity.

### IN-02: `holdPct` state is binary (0 or 100), naming implies a granular progress value

**File:** `src/components/ConfirmSheet.jsx:5,14,21`
**Issue:** `holdPct` is only ever set to `0` or `100` and relies entirely on the CSS `transition` to animate between them — it is never updated incrementally (e.g., via `requestAnimationFrame` tied to elapsed hold time). The name suggests a live/continuous percentage, which could mislead future maintainers into assuming there's frame-accurate progress tracking.
**Fix:** Rename to something like `holdFillTarget` or `holdEngaged`, or add a short comment clarifying it's a CSS-transition trigger, not a live progress value.

---

_Reviewed: 2026-09-05T08:40:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
