---
phase: 03-interaction-quality-audit
plan: 1
subsystem: cross-cutting
tags: [interaction-audit, data-loss, confirmation-gates, menu-state]
dependency_graph:
  requires: []
  provides:
    - "Every interactive control across 9 named screens verified against its stated action"
    - "START_WORKOUT never silently discards an in-progress session"
    - "All destructive deletes gated behind confirmation"
  affects:
    - src/screens/Routines.jsx
    - src/screens/RoutineBuilder.jsx
    - src/screens/Home.jsx
    - src/screens/WorkoutOverview.jsx
    - src/state/reducer.js
    - src/screens/Measurements.jsx
    - src/screens/Settings.jsx
tech_stack:
  added: []
  patterns:
    - "Outside-tap-dismiss backdrop for ad-hoc action menus (fixed inset-0, z-index below the menu, above content)"
    - "Single-source-of-truth for 'which item's menu is open' lifted to the nearest shared parent, not per-instance local state"
key_files:
  modified:
    - src/screens/Routines.jsx
    - src/screens/RoutineBuilder.jsx
    - src/screens/Home.jsx
    - src/screens/WorkoutOverview.jsx
    - src/state/reducer.js
    - src/screens/Measurements.jsx
    - src/screens/Settings.jsx
    - .planning/PROJECT.md
decisions:
  - "Measurement and goal deletes use single-tap ConfirmSheet (not holdToConfirm) — that gesture is reserved specifically for the app-wide 'Delete all data' wipe per SAFE-01/02; a single measurement/goal entry is a smaller-blast-radius deletion consistent with the existing routine-delete precedent"
  - "START_WORKOUT resume-instead-of-overwrite implemented at both the UI call sites (Home.jsx, WorkoutOverview.jsx) AND as a reducer-level no-op guard, matching this codebase's existing defense-in-depth convention for reducer actions"
  - "RoutineBuilder's drag-gesture backgrounding edge case was found but deliberately not fixed — recorded in PROJECT.md with reasoning (low severity, non-destructive, reversible) rather than silently dropped, per QA-02's explicit requirement"
metrics:
  duration: "~50 min"
  completed: 2026-09-05
status: complete
---

# Phase 3 Plan 1: Interaction Quality Audit Summary

Performed a systematic code-reading audit of every interactive control (button, toggle, gesture, drag handle) across all 9 screens named in Phase 3's success criteria — Home, Routines, Routine Builder, Active Workout, Stats hub (all 4 tabs), Measurements, CSV Import, Export & Insights, and Settings — plus every screen and shared component they link to (WorkoutOverview, ExerciseDetail, ExerciseLibrary, WorkoutSummary, BottomNav, ConfirmSheet, SessionBar, SegmentedControl, WeekStrip, BodyHeatmap, ProgressBar, LineChart). No device/browser was available in this execution environment, so "manually exercised" was performed as tracing every handler's actual dispatch/navigation/state-update against what the control visually claims to do — the on-device pass itself is deferred to `03-UAT.md`.

## What Was Found and Fixed

1. **Routines.jsx — action menu had no outside-tap dismiss.** The per-routine "⋮" menu (`menuFor` state) stayed open indefinitely unless the same button was tapped again or a menu item was picked. Added a `fixed inset-0 z-[5]` backdrop, matching the `ConfirmSheet`/`AddGoalSheet`/`ScheduleEditSheet` pattern already used elsewhere in the app.
2. **RoutineBuilder.jsx — two block menus could be open simultaneously.** `BlockRow`'s "⋮" menu used `useState` local to each row, so opening block A's menu then block B's left both visibly open at once — the menu's implicit "exclusive" contract was broken. Lifted the state to the parent (`blockMenuFor`, mirroring `Routines.jsx`'s `menuFor`) and added the same outside-tap backdrop.
3. **Home.jsx / WorkoutOverview.jsx / reducer.js — "Start Workout" silently discarded an in-progress session.** Neither call site (nor the reducer) guarded against `state.activeWorkout` already being set — tapping "Start Workout" again (now easy to do accidentally via Phase 2's SessionBar-enabled navigation) silently overwrote the active session with a fresh one, losing all logged sets. This is the most severe finding — a direct violation of the project's core "never lose data" value. Fixed by making both UI call sites resume the existing session instead (mirroring `BottomNav.jsx`'s already-correct `handleLog`), plus a reducer-level no-op guard as a backstop.
4. **Measurements.jsx — entry delete had no confirmation.** Single-tap `DELETE_MEASUREMENT`, no `ConfirmSheet`, inconsistent with every other delete in the app. Fixed with a `ConfirmSheet`.
5. **Settings.jsx — goal delete had no confirmation.** Identical defect to #4, on `DELETE_GOAL`. Fixed with a second `ConfirmSheet` instance.

## What Was Audited and Found Correct (No Changes Needed)

Home's goal cards and Add Goal sheet; StatsHub's tab switching and all 4 tabs (Overview's range toggle, Muscles' heatmap-tap filtering, Log's session/entry expansion, the Measurements tab-link special-case route); ActiveWorkout's rest timer adjust/skip, set add/remove (guarded against going below 1 set), RIR chip selection, exercise-chip navigation, and finish-with-incomplete-sets confirmation; CsvImport's full 5-step wizard; ExportInsights' CSV/PDF export and date-range filtering; ExerciseDetail's metric toggle and notes-on-blur autosave; WorkoutSummary's note-and-done flow; ExerciseLibrary's search/filter/create-custom flow; WeekStrip's week pagination and day-tap navigation; BodyHeatmap's region-tap filtering; SegmentedControl and ProgressBar (no interactive surface beyond their own onChange, already correct).

## Self-Review Catch (Post-Fix Consistency Check)

While reviewing the two new action-menu backdrops (#1 and #2 above) for consistency with the Phase 1 WR-04 modal-stack fix, found that neither backdrop was registered with `src/lib/modalStack.js` — meaning Android hardware back would navigate away instead of dismissing an open menu, the same class of gap WR-04 fixed for `ConfirmSheet`, now reachable through a different overlay. Extended both `Routines.jsx` (`menuFor`) and `RoutineBuilder.jsx` (`blockMenuFor`) to push/pop through the same shared modal stack, so Android back now dismisses either menu correctly.

## Deferred (Not Fixed — Recorded Per QA-02)

RoutineBuilder's drag-to-reorder gesture has no `visibilitychange`/`blur` interrupt safeguard (same category as Phase 1's CR-01, but lower severity — reordering is non-destructive and reversible, and `onPointerCancel` already covers the common interruption path). Recorded in `PROJECT.md`'s Context section with explicit reasoning rather than silently dropped.

## Human Verification Deferred

Per the same explicit user direction as Phases 1 and 2, the actual on-device "manually exercise every control" pass was not performed in this session — no device/browser available. Deferred to `03-UAT.md`.
