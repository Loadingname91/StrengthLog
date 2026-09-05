---
phase: 02-uninterrupted-workout-sessions
plan: 1
subsystem: session-continuity
tags: [session-bar, wall-clock, back-button, navigation]
dependency_graph:
  requires: []
  provides:
    - "SessionBar component: persistent floating workout-in-progress indicator with live clock"
  affects:
    - src/App.jsx
    - src/screens/ActiveWorkout.jsx
tech_stack:
  added: []
  patterns:
    - "visibilitychange listener for immediate clock refresh on app foreground (same pattern as ConfirmSheet.jsx's Phase 1 backgrounding-abort fix)"
key_files:
  created:
    - src/components/SessionBar.jsx
  modified:
    - src/App.jsx
    - src/screens/ActiveWorkout.jsx
decisions:
  - "SessionBar computes elapsed time with the identical wall-clock-diff formula as ActiveWorkout.jsx (now - startedAt, floored to seconds) rather than sharing a hook, to keep this plan's diff minimal — both read the same state.activeWorkout.startedAt so they can never disagree"
  - "DISCARD_WORKOUT is defined in the reducer but dispatched from nowhere in the current codebase — session-continuity (SESSION-03) was already structurally guaranteed before this plan; no reducer changes were needed for it"
metrics:
  duration: "~25 min"
  completed: 2026-09-05
status: complete
---

# Phase 2 Plan 1: Persistent Session Bar + Wall-Clock Hardening Summary

Added `src/components/SessionBar.jsx`, a floating tappable bar showing "Workout in progress — {routine name}" with a live elapsed clock, mounted in `App.jsx`'s `Shell` alongside `BottomNav` (same `withNav` gate, so it appears on Home/Routines/Stats/Settings and nowhere else). Both `SessionBar` and `ActiveWorkout.jsx` now refresh their clocks immediately on `visibilitychange` in addition to their existing 1-second interval, so backgrounding/foregrounding never leaves a stale number on screen even briefly.

## What Was Built

- **Task 1 (`src/components/SessionBar.jsx` new, `src/App.jsx` modified):** New component reads `state.activeWorkout` via `useStore()`, renders `null` when absent. When active, renders a `fixed bottom-[70px]` rounded bar (accent background, white text, `ClockIcon`, truncated routine name, `fmtElapsed()`-formatted elapsed time) that navigates to `/workout` on tap. Elapsed time uses `useState(() => Date.now())` (lazy initializer — avoids an oxlint `react(purity)` warning that a bare `useState(Date.now())` triggers) updated by a 1s `setInterval`. Mounted in `App.jsx`'s `Shell()` via `{withNav && <SessionBar />}` immediately before the existing `{withNav && <BottomNav />}` line, so it shares `BottomNav`'s exact screen-gating and never renders on `/workout` itself. Added a `sessionActive` boolean (`withNav && !!state.activeWorkout`) that bumps the content wrapper's `paddingBottom` from 84px to 140px when a session is active, so scrollable content doesn't sit under the new bar.
- **Task 2 (`src/screens/ActiveWorkout.jsx` modified):** Added a second `useEffect` registering a `visibilitychange` listener that calls `setNow(Date.now())` immediately when the document becomes visible again, additive to the existing 1s interval. Verified by reading (no code changes needed) that `useAndroidBackButton` in `App.jsx` only ever calls `navigate(-1)`/`navigate('/')`/`CapacitorApp.exitApp()`, `BottomNav.jsx`'s tab links and `handleLog()` only ever call `navigate()`, and `ActiveWorkout.jsx`'s own header back button is a plain `navigate('/routines')` — none dispatch anything. A repo-wide grep confirmed `DISCARD_WORKOUT` (the only reducer action that clears `activeWorkout` outside of `FINISH_WORKOUT`/`DELETE_ALL_DATA`) is defined in `reducer.js` but dispatched from nowhere in the codebase, so SESSION-03 was already structurally guaranteed.

## Deviations from Plan

None — plan executed as written. One implementation detail not called out in the plan: used a lazy `useState` initializer for `Date.now()` in `SessionBar` to avoid a new oxlint warning that a direct call would have introduced (`ActiveWorkout.jsx`'s pre-existing identical-looking `useState(Date.now())` does not trigger this warning for reasons not fully understood — likely an oxlint heuristic difference — but the lazy form is strictly safer either way, so it was used for the new file).

## Human Verification Deferred

Per explicit user direction, on-device/browser testing for this plan (visual placement of the bar, tap-to-resume landing on the correct exercise, and the backgrounding/foregrounding clock-accuracy check) was not performed in this session — no device/browser available here. Deferred to the phase's `02-UAT.md`.
