---
phase: 01-fresh-install-safe-deletion
fixed_at: 2026-09-05T08:55:00Z
review_path: 01-REVIEW.md
fix_scope: critical_warning
findings_in_scope: 7
fixed: 6
skipped: 1
iteration: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fix scope:** critical_warning (Critical + Warning findings; Info findings out of scope by default)
**Findings in scope:** 7 (2 critical, 5 warning)
**Fixed:** 6
**Skipped:** 1

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

## Skipped

### WR-04: Android back button has no awareness of the open destructive confirmation sheet
**Reason:** The review itself flags this as a pre-existing architectural gap (`App.jsx`'s `useAndroidBackButton` has no concept of an open modal/sheet), not something introduced by this phase's changes. A correct fix requires a shared modal-stack mechanism across every `ConfirmSheet` call site (`Settings.jsx`, `Routines.jsx`, `ActiveWorkout.jsx`) and the global back-button handler in `App.jsx` — a cross-cutting change to core navigation behavior well beyond this phase's two plans (fresh-install empty state, hold-to-confirm gesture). Fixing it as a one-off inside `ConfirmSheet.jsx` alone (e.g. a local `backButton` listener calling `onCancel`) would not actually stop the global handler's `navigate(-1)`/`navigate('/')` from also firing, so it would not resolve the underlying issue. Deferred as a known gap for separate, deliberate design — not folded into this phase's fix pass.

## Out of scope (Info findings, excluded from critical_warning fix scope)

- IN-01: No keyboard equivalent for the hold-to-confirm gesture (accessibility)
- IN-02: `holdPct` naming implies granular progress but is binary

## Verification

`npm run build` and `npm run lint` both pass (exit 0) after each commit above; lint shows only pre-existing warnings plus one new `react(set-state-in-effect)` warning on the WR-01 fix, matching an already-accepted pattern elsewhere in the codebase (`ActiveWorkout.jsx`).
