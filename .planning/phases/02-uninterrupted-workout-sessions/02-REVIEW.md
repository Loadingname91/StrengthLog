---
phase: 02-uninterrupted-workout-sessions
reviewed: 2026-09-05T09:45:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/components/SessionBar.jsx
  - src/App.jsx
  - src/screens/ActiveWorkout.jsx
  - src/screens/RoutineBuilder.jsx
  - src/state/reducer.js
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-05T09:45:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** clean

## Summary

This phase adds a persistent floating session bar with a live clock (SessionBar.jsx, mounted in App.jsx), hardens both clocks (SessionBar and ActiveWorkout) with an immediate foreground refresh, adds an optional target-weight field to Routine Builder's block editor, and threads that value through to Active Workout as a weight-ghost fallback. Traced the full data flow (RoutineBuilder → reducer.js buildActiveWorkoutFromRoutine → ActiveWorkout.jsx SetRow) and the navigation/state-continuity paths (useAndroidBackButton, BottomNav, ActiveWorkout's own back control) referenced by this phase's must-haves. No correctness defects found. Two Info-level notes, neither blocking.

## Critical Issues

None.

## Warnings

None.

## Info

### IN-03: SessionBar's effects re-arm on every activeWorkout object-identity change, not just mount/unmount
**File:** `src/components/SessionBar.jsx:13-25`
**Issue:** Both `useEffect` hooks (the 1s interval and the `visibilitychange` listener) depend on `[aw]`, where `aw = state.activeWorkout`. Because the reducer spreads a new `activeWorkout` object on every action that touches it (`SET_SET_FIELD`, `TOGGLE_SET_DONE`, `GOTO_EXERCISE`, etc.), these effects tear down and re-register on every keystroke/tap during active logging, not just when a workout starts or ends. This is functionally harmless — `elapsedSec` is always recomputed from `now - startedAt` at render time, so a reset interval phase is imperceptible — but it is unnecessary churn.
**Why not fixed:** The `[aw]` dependency is required for a different reason: SessionBar is mounted once in the app shell and stays mounted across the whole session, so the effect must re-run when `aw` transitions from `null` to a real object (workout just started) to actually arm the interval for the first time — a mount-once (`[]`) dependency would never re-register once SessionBar had already rendered once with no active workout. A more precise fix (re-arming only on the null↔non-null transition, not on every field edit) is possible but adds complexity disproportionate to the actual cost (a redundant `clearInterval`/`setInterval` pair, both O(1)). Left as-is.

### IN-04: `Number(targetWeight)` can produce `NaN` from a malformed manual entry
**File:** `src/screens/RoutineBuilder.jsx` (Target weight field, `onSave` conversion)
**Issue:** If a user manages to enter a value that isn't cleanly numeric before tapping "Save exercise", `Number(targetWeight)` could store `NaN` on the block, which would later render as the literal string `"NaN"` in Active Workout's weight placeholder.
**Why not fixed:** This is the exact same pattern already used by the pre-existing RIR field (`setRir(e.target.value === '' ? null : Number(e.target.value))`), which has shipped without incident — `<input type="number">` constrains manual entry in supported browsers/WebViews closely enough that this is a theoretical edge case shared across the whole codebase's numeric-field convention, not a regression introduced by this phase. Fixing it here alone (e.g. an `isNaN` guard) without also fixing Sets/Rest/Min reps/Max reps/RIR would be an inconsistent, partial fix; fixing all of them is a separate, codebase-wide hardening task outside this phase's scope.

## Verification

`npm run build` and `npm run lint` both pass (exit 0) after every commit in this phase; lint shows only pre-existing warnings.
