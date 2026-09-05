---
phase: 06-structured-sets
plan: 1
subsystem: routine-builder
tags: [data-model, sequence, superset-merge, backfill]
dependency_graph:
  requires: []
  provides:
    - "block.sequence: an ordered array of set/round/rest steps, replacing block.sets + block.rest"
    - "Lazy, non-destructive backfill for routines saved before this milestone"
    - "Routine Builder sequence editor: add/remove/edit rest rows, add sets"
    - "Superset merge/ungroup builds/splits round-aware sequences"
  affects:
    - src/lib/blocks.js
    - src/lib/format.js
    - src/screens/RoutineBuilder.jsx
    - src/screens/Routines.jsx
    - src/screens/WorkoutOverview.jsx
tech_stack:
  added: []
  patterns:
    - "Lazy backfill on read (backfillSequence), never a stored migration — mirrors buildInitialState()'s existing weekdayAssignments/scheduleRestartAt precedent"
    - "Derived values instead of duplicated fields: block.sets/block.rest are never read again after this plan; sequenceSetCount/sequenceRestTotal compute them from sequence wherever needed"
key_files:
  created:
    - src/lib/blocks.js
    - src/lib/blocks.test.js
  modified:
    - src/lib/format.js
    - src/screens/RoutineBuilder.jsx
    - src/screens/RoutineBuilder.test.jsx
    - src/screens/Routines.jsx
    - src/screens/WorkoutOverview.jsx
decisions:
  - "The '+ Add Set' button keeps that exact label even for superset blocks (not '+ Add Round') — the UI-SPEC's explicit copy decision; only the row ordinal labels ('Round 1' vs 'Set 1') differ by block type"
  - "Removing a set/round also removes its immediately-following rest step, if any — avoids leaving an orphaned back-to-back rest with nothing to separate"
  - "'+ Add rest' gap link only appears between interior set/round rows (not after the very last one) — matches the UI-SPEC's literal 'between two adjacent rows' wording; a user who wants trailing rest can still add one manually if a future need arises, just not auto-offered"
metrics:
  duration: "~50 min"
  completed: 2026-09-05
status: complete
---

# Phase 6 Plan 1: Data Model & Routine Builder Authoring UI Summary

Implemented the `sequence` data model and Routine Builder's authoring UI for REST-01 through REST-04 and SUPER-01. Active Workout's runtime (rest rows in Active Workout, superset auto-advance) is Plan 2 — this plan is data model + authoring only.

## What Was Built

1. **`src/lib/blocks.js`** — `backfillSequence(block)` derives a `set`/`round` + `rest` sequence from a legacy block's `sets`/`rest`/`type` fields, with no trailing rest after the last item; returns the block unchanged (same reference) if it already has a `sequence`. `sequenceSetCount`/`sequenceRestTotal` derive a block's effective set count and total rest duration from its sequence — the single source of truth going forward; `block.sets`/`block.rest` are never read again anywhere in the codebase after this plan.

2. **`blockTarget()`** (`src/lib/format.js`) now derives its set count from `sequence` when present, falling back to `block.sets` for the (never-actually-hit, since callers always pass through backfill first) raw case.

3. **Routine Builder's sequence editor** (`BlockEditSheet`) — replaces the old "Sets"/"Rest (sec)" number inputs with an ordered list: each set/round row shows its ordinal ("Set N" or "Round N" depending on block type) with a remove control (hidden when it's the only one left); each rest row shows a clock icon, an editable seconds input, and a remove control; a "+ Add rest" ghost link appears between adjacent set/round rows with no rest between them. "+ Add Set" appends a set/round plus a rest step defaulting to Settings' "Default rest (sec)".

4. **Superset merge/ungroup** — `groupSuperset()` now builds the merged block's sequence by converting the first selected block's `set` steps to `round` steps (rest steps pass through unchanged), continuing that function's existing precedent of keeping the first block's other fields. `ungroup()` splits symmetrically, converting `round` back to `set`.

5. **Duration/set/rep estimates** (`Routines.jsx`, `WorkoutOverview.jsx`) — updated to derive from `sequence` instead of `block.sets`/`block.rest`, preserving each file's existing approximation convention (50s/set, superset rounds scaled by `exerciseIds.length`, matching how these files already scaled set/rep totals for supersets).

## Verification

- `npm test`: **75/75 passing** (8 new in `blocks.test.js`, 3 new in `RoutineBuilder.test.jsx` covering add-set-appends-rest, remove-and-re-add-rest round-trip, and the can't-remove-last-set guard). Existing tests (which use a legacy block shape with no `sequence`) pass unchanged, confirming the backfill is transparent.
- `npm run lint`/`npm run build`: clean, no new warnings.
- **Real browser check** (Chromium): built a routine with two exercises, confirmed the default sequence editor shows 3 sets and 2 rest rows defaulting to Settings' 90s; merged them into a superset via the existing "Group as superset" flow and confirmed the merged block shows both exercise names, the SUPERSET badge, a correctly-summed "180s rest" (2×90s), and that its own sequence editor shows "Round" labels instead of "Set". 7/7 checks passed (two initial failures were bugs in the test script's exercise-picker selector, not the app — fixed to search by name before clicking).

## Deferred

Active Workout's consumption of `sequence` (rest rows in the workout view, superset auto-advance and merged rendering) is Plan 2 (`06-02-PLAN.md`) — routines built in this plan will run in Active Workout exactly as before until Plan 2 lands, since `buildActiveWorkoutFromRoutine` hasn't been touched yet.
