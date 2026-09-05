---
phase: 01-fresh-install-safe-deletion
plan: 1
subsystem: state
tags: [fresh-install, empty-state, seed-removal, localStorage]
dependency_graph:
  requires: []
  provides:
    - "buildInitialState() fresh-install branch returns a fully-empty state literal"
  affects:
    - src/state/StoreContext.jsx
tech_stack:
  added: []
  patterns:
    - "Explicit empty-state object literal replaces spread-from-generator pattern for fresh installs"
key_files:
  created: []
  modified:
    - src/state/StoreContext.jsx
  deleted:
    - src/lib/seed.js
    - src/lib/rng.js
decisions:
  - "Matched the deleted buildSeed()'s exact 12-key return shape in the new empty-state literal, so no reducer/selector field goes undefined on first launch"
  - "Left the if (persisted) branch character-for-character untouched to structurally guarantee DATA-02 (existing users never fall into the fresh-install path)"
metrics:
  duration: "~15 min"
  completed: 2026-09-05
status: complete
---

# Phase 1 Plan 1: Delete Seed Generator, Empty Fresh-Install State Summary

Removed the entire demo-data generator (`src/lib/seed.js`, `src/lib/rng.js`) and rewired `buildInitialState()`'s fresh-install branch in `src/state/StoreContext.jsx` to return an explicit 12-field empty-state literal (`routines: []`, `sessions: []`, `measurements: []`, `goals: []`, etc.) instead of spreading `buildSeed()`, so every fresh install now boots with zero routines and zero history.

## What Was Built

- **Task 1:** Deleted `src/lib/seed.js` and `src/lib/rng.js` outright (confirmed single-importer chain before deletion: `StoreContext.jsx` → `seed.js` → `rng.js`, no other references anywhere in `src/`). In `src/state/StoreContext.jsx`, removed `import { buildSeed } from '../lib/seed'`, added `import { todayISO } from '../lib/format'`, and replaced the `...buildSeed()` spread in the fresh-install `else` branch with the 12 explicit fields matching `buildSeed()`'s prior return shape exactly: `routines: []`, `routineOrder: []`, `sequenceIndex: 0`, `routineMode: 'sequence'`, `weekdayAssignments: defaultWeekdayAssignments([])`, `scheduleRestartAt: null`, `sessions: []`, `measurements: []`, `goals: []`, `activeWorkout: null`, `lastImportedAt: null`, `createdAt: todayISO()`. The four pre-existing fields (`settings`, `user`, `customExercises`, `exerciseNotes`, `importPresets`, `lastFinishedSession`) were left untouched.
- **Task 2 (verification-only, no code changes):** Confirmed by reading that Home.jsx (`hasHistory = state.sessions.length > 0`), StatsHub.jsx (`!filtered.length` → "No workouts logged yet."), Settings.jsx (`!state.goals.length` → "No goals yet — add one from Home."), and Routines.jsx (`ordered = state.routineOrder.map(...).filter(Boolean)` → `[]`, leaving only "+ New Routine") all correctly render against the new fully-empty state shape with zero code changes needed. Also re-confirmed the `if (persisted) { ... return persisted }` branch in `StoreContext.jsx` is exactly as it was before Task 1 (still starts with `if (persisted) {`, still contains both pre-existing backfill checks, still ends with `return persisted`), which is the structural evidence DATA-02 holds.

## Verification Results

- `npm run build` — succeeds, no errors (verified after Task 1 and again after Task 2).
- `npm run lint` — exits 0, zero errors (only pre-existing warnings in unrelated files: `reducer.js`, `LineChart.jsx`, `ToastContext.jsx`, `Home.jsx`, `StatsHub.jsx`, `RoutineBuilder.jsx`, `ActiveWorkout.jsx` — none introduced by this plan).
- `test ! -f src/lib/seed.js && test ! -f src/lib/rng.js` — both files confirmed deleted.
- `grep -q "buildSeed" src/state/StoreContext.jsx` — no match, import and call site fully removed.
- `grep -n "if (persisted)" src/state/StoreContext.jsx` — present, unchanged.
- `grep -c "hasHistory"` (Home.jsx), `"No workouts logged yet"` (StatsHub.jsx), `"No goals yet"` (Settings.jsx) — all present as expected.

## Known Stubs / Manual Follow-up Required

Task 2's `<human-check>` verification step could not be executed in this sandboxed, non-interactive execution environment (no browser/Android device available to clear `localStorage` and visually inspect the app). This is a manual follow-up for the user:

1. Clear this device/browser's localStorage for the app origin (Chrome DevTools → Application → Local Storage → delete the `fitlog:v1` key, or uninstall/reinstall the Android app) and reload.
2. Confirm: Home shows no workout history and no upcoming-routine card; Routines shows only the "+ New Routine" button; Stats hub shows "No workouts logged yet."; Settings' Goals card shows "No goals yet — add one from Home."
3. Without clearing storage again, log a real set or add a routine, reload, and confirm that data is still there (proves the fresh-install branch only ever ran once, on the truly-empty install).

This does not block the plan's completion — all code-level changes and automated verifications pass; this is a runtime/device confirmation step outside the execution sandbox's capability.

## Deviations from Plan

None — plan executed exactly as written. Task 2 made zero file edits, matching its stated read-only/verification-only scope, so no commit was created for Task 2 (only Task 1 produced file changes).

## Self-Check: PASSED

- FOUND: src/state/StoreContext.jsx (modified, contains explicit empty-state literal, no buildSeed reference)
- MISSING confirmed intentional: src/lib/seed.js, src/lib/rng.js (both deleted as required by plan)
- FOUND commit: c81c48d (feat(01-01): delete seed generator, empty fresh-install state)
