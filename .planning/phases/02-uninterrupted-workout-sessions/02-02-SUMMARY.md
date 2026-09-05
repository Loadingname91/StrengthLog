---
phase: 02-uninterrupted-workout-sessions
plan: 2
subsystem: routine-builder
tags: [target-weight, ghost-value, active-workout]
dependency_graph:
  requires: []
  provides:
    - "block.targetWeight optional field on routine blocks"
    - "Active Workout weight-placeholder fallback to target weight when no history exists"
  affects:
    - src/screens/RoutineBuilder.jsx
    - src/state/reducer.js
    - src/screens/ActiveWorkout.jsx
tech_stack:
  added: []
  patterns:
    - "Explicit-null convention for optional numeric block fields (matches existing rir field)"
key_files:
  modified:
    - src/screens/RoutineBuilder.jsx
    - src/state/reducer.js
    - src/screens/ActiveWorkout.jsx
decisions:
  - "targetWeight is scoped per block (shared across both exercises in a superset pair), matching how sets/rest/rir are already shared per block rather than per exercise — consistent with existing data model, no new per-exercise structure introduced"
  - "Old routines saved before this plan predate the field entirely (undefined, not null) — buildActiveWorkoutFromRoutine coerces with ?? null so no crash and no undefined leaking into exercise objects"
metrics:
  duration: "~15 min"
  completed: 2026-09-05
status: complete
---

# Phase 2 Plan 2: Target Weight Field + Ghost Fallback Summary

Added an optional "Target weight" field to Routine Builder's block editor, carried it through `buildActiveWorkoutFromRoutine` onto each exercise, and used it in Active Workout as the weight input's placeholder/fill-in value only when no real last-session data exists for that exercise yet.

## What Was Built

- **Task 1 (`src/screens/RoutineBuilder.jsx`):** `BlockEditSheet` gained a `targetWeight` state (`block.targetWeight ?? ''`) and a new "Target weight (optional)" numeric `Field`, styled identically to the existing RIR field, placed directly after it. `onSave` now includes `targetWeight: targetWeight === '' ? null : Number(targetWeight)`, matching RIR's explicit-null-when-unset convention. New blocks (`addExercise`) default `targetWeight: null` explicitly.
- **Task 2 (`src/state/reducer.js`, `src/screens/ActiveWorkout.jsx`):** `buildActiveWorkoutFromRoutine` now copies `block.targetWeight ?? null` onto each exercise entry it builds. `ActiveWorkout.jsx` passes `current.targetWeight` to `SetRow` as a new prop. `SetRow` computes `weightPlaceholder = ghost ? String(ghost.weight) : (targetWeight != null ? String(targetWeight) : '—')` and uses it for the weight input's placeholder; `fillGhost` was generalized to accept a fallback (`ghost ? ghost[field] : (field === 'weight' ? targetWeight : null)`) so tapping an empty weight input with no ghost data but a target weight fills it in exactly like a real ghost would. The reps placeholder and the "Last" column text are untouched — a target weight has no associated target rep count.

## Deviations from Plan

None — plan executed as written.

## Human Verification Deferred

Per explicit user direction, on-device testing (creating a routine with a target weight, starting it fresh, confirming the placeholder/fill behavior, then confirming real history takes priority once logged) was not performed in this session. Deferred to the phase's `02-UAT.md`.
