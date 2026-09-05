---
phase: 01-fresh-install-safe-deletion
fixed_at: 2026-09-05T08:55:00Z
updated: 2026-09-05T09:30:00Z
review_path: 01-REVIEW.md
fix_scope: critical_warning
findings_in_scope: 7
fixed: 7
skipped: 0
iteration: 2
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fix scope:** critical_warning (Critical + Warning findings; Info findings out of scope by default)
**Findings in scope:** 7 (2 critical, 5 warning)
**Fixed:** 7
**Skipped:** 0

> **Update (iteration 2):** WR-04, originally skipped as out-of-proportion, was addressed per explicit user request before starting Phase 2. See "Fixed" below — moved out of "Skipped".

## Fixed

### CR-01: Hold-to-confirm gesture had no defense against interrupted holds
**Commit:** `98d7fff`
Added `visibilitychange`/`blur` listeners in `ConfirmSheet.jsx` that abort the in-flight hold timer and reset visual state, so backgrounding mid-press can no longer fire `onConfirm()` after the app resumes.

### CR-02: Delete-all confirmation promised the exercise library is kept, but it was wiped
**Commit:** `38388b5`
Removed `customExercises: []` / `exerciseNotes: {}` from the `DELETE_ALL_DATA` reducer case so behavior matches the dialog's stated promise.

### WR-01: Hold progress state was never reset after a successful confirm
**Commit:** `fe47df7`
Added a `useEffect` on `[open]` in `ConfirmSheet.jsx` that resets `holding`/`holdPct` whenever the sheet opens, preventing a stale pre-filled bar on next open.

### WR-02: Fresh install still hardcoded a demo persona name
**Commit:** `2f47194`
Replaced `user: { name: 'Marcus' }` with a generic placeholder (`'Athlete'`) in `buildInitialState()`'s fresh-install branch. No onboarding/name-entry flow exists yet, so a non-empty generic default was used rather than introducing a new feature out of this phase's scope.

### WR-03: `DELETE_ALL_DATA` didn't clear `lastFinishedSession`
**Commit:** `38388b5`
Added `lastFinishedSession: null` to the `DELETE_ALL_DATA` reducer case (same commit as CR-02) so `WorkoutSummary.jsx` can't render a session that no longer exists after a delete-all.

### WR-05: Hold duration hardcoded in two independent places
**Commit:** `fe47df7`
Extracted `HOLD_DURATION_MS = 1500` in `ConfirmSheet.jsx` and used it for both the `setTimeout` delay and the CSS transition duration string (same commit as WR-01).

### WR-04: Android back button has no awareness of the open destructive confirmation sheet
**Commit:** `e5b341c`
Originally skipped in iteration 1 as out-of-proportion for a one-file patch (a correct fix needed a mechanism shared across every `ConfirmSheet` call site and the global back-button handler, not a local change). Addressed in iteration 2, before starting Phase 2, per explicit user request: added `src/lib/modalStack.js`, a small shared stack that `ConfirmSheet` pushes its `onCancel` onto while open; `App.jsx`'s `useAndroidBackButton` now calls `dismissTopModal()` first and returns early if a modal was open, before falling through to `navigate(-1)`/`navigate('/')`/`exitApp()`. This fixes all three `ConfirmSheet` call sites (`Settings.jsx` delete-all, `Routines.jsx` delete-routine, `ActiveWorkout.jsx` finish-anyway) without modifying any of them individually — only `ConfirmSheet.jsx` and `App.jsx` changed.

## Out of scope (Info findings, excluded from critical_warning fix scope)

- IN-01: No keyboard equivalent for the hold-to-confirm gesture (accessibility)
- IN-02: `holdPct` naming implies granular progress but is binary

## Verification

`npm run build` and `npm run lint` both pass (exit 0) after each commit above; lint shows only pre-existing warnings plus one new `react(set-state-in-effect)` warning on the WR-01 fix, matching an already-accepted pattern elsewhere in the codebase (`ActiveWorkout.jsx`).
