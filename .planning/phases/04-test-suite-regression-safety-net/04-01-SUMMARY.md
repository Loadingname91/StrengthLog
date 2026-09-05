---
phase: 04-test-suite-regression-safety-net
plan: 1
subsystem: testing
tags: [vitest, testing-library, regression-suite, reducer, smoke-tests]
dependency_graph:
  requires:
    - "Phase 1: DELETE_ALL_DATA, buildInitialState seed-removal path, ConfirmSheet holdToConfirm"
    - "Phase 2: SessionBar"
    - "Phase 3: START_WORKOUT no-overwrite guard"
  provides:
    - "npm test runs a full Vitest suite once and exits pass/fail"
    - "Regression coverage for this milestone's riskiest reducer actions and newest interactive features"
  affects:
    - package.json
    - vite.config.js
    - src/test/setup.js
    - src/state/reducer.js
    - src/state/StoreContext.jsx
    - src/screens/RoutineBuilder.jsx
tech_stack:
  added:
    - vitest ^5.0.0
    - "@testing-library/react ^16.3.3"
    - "@testing-library/jest-dom ^7.0.1"
    - jsdom ^30.0.1
  patterns:
    - "Vitest config lives in vite.config.js's `test` block, not a separate vitest.config.js"
    - "Test-only `export` keyword added to internal functions (buildInitialState, BlockEditSheet) needed for isolated unit/component testing — no behavior change, still called internally exactly as before"
    - "afterEach(cleanup) wired centrally in src/test/setup.js rather than per test file"
key_files:
  modified:
    - package.json
    - vite.config.js
    - src/test/setup.js
    - src/state/StoreContext.jsx
    - src/screens/RoutineBuilder.jsx
  created:
    - src/state/reducer.test.js
    - src/state/StoreContext.test.jsx
    - src/components/ConfirmSheet.test.jsx
    - src/screens/RoutineBuilder.test.jsx
    - src/components/SessionBar.test.jsx
decisions:
  - "Real exercise data (exerciseById('bench-press')) used in RoutineBuilder.test.jsx instead of mocking lib/exercises — the catalog is static and the lookup is a safe .find() with a fallback, so mocking would add indirection without reducing risk"
  - "SessionBar.test.jsx mocks useStore() wholesale rather than standing up a full StoreProvider — the component only reads state.activeWorkout, so a real provider would add setup cost with no coverage benefit"
  - "afterEach(cleanup) added to the shared setup.js (not per-file) once multiple render() calls in the same file surfaced duplicate-DOM-node failures — centralizing it means every future component test file gets automatic cleanup for free"
metrics:
  duration: "~35 min (Task 3 + Task 4 only; Tasks 1-2 landed in a prior session)"
  completed: 2026-09-05
status: complete
---

# Phase 4 Plan 1: Test Suite & Regression Safety Net Summary

Completed the two remaining tasks of this phase's single plan: Task 3 (smoke-level interaction tests for the hold-to-confirm gesture, the target-weight field, and the persistent session bar) and Task 4 (a clean, zero-error run of `npm test` + `npm run lint` + `npm run build` together). Tasks 1 (Vitest/Testing Library install and config) and 2 (reducer + buildInitialState unit tests) had already landed in a prior session's commits (`3674034`, `4dedeed`).

## What Was Built

1. **`src/components/ConfirmSheet.test.jsx`** — two tests against the real `holdToConfirm` gesture using `vi.useFakeTimers()`: a full 1500ms hold calls `onConfirm` exactly once; a hold released at 500ms (with the remaining 1000ms then advanced) never calls `onConfirm`. Exercises the exact `HOLD_DURATION_MS` timing contract, not a mock of it.
2. **`src/screens/RoutineBuilder.test.jsx`** — added a named `export` to `BlockEditSheet` (previously module-private) so it can be rendered in isolation without the full `RoutineBuilder` route/store tree. Two tests: typing "60" into the "Target weight (optional)" field and saving passes `targetWeight: 60` (a number, not the string `"60"`) to `onSave`; leaving it blank passes `targetWeight: null`.
3. **`src/components/SessionBar.test.jsx`** — mocks `useStore` from `../state/StoreContext` entirely (the component's only dependency besides routing). With `activeWorkout: null` the component renders nothing (`container.firstChild` is `null`); with an active workout set, the routine name ("Push Day") appears in the document.
4. **`src/test/setup.js`** — added `afterEach(cleanup)` from `@testing-library/react`. This project's Vitest config doesn't enable `test.globals`, so Testing Library's usual auto-cleanup hook was never registered; two of the three new smoke-test files render more than once per file and immediately hit "found multiple elements" failures from leftover DOM until this was added.

## Verification

Ran `npm test`, `npm run lint`, and `npm run build` together as Task 4 requires:
- `npm test` — **5 test files, 12 tests, all passing.**
- `npm run lint` — 11 pre-existing warnings (unchanged from before this phase's changes — the two new `export` keywords did not trigger any new `only-export-components` or other warning), **zero errors**.
- `npm run build` — succeeds unchanged (test-only additions don't affect the production bundle).

## Requirements Closed

- **TEST-01** (Vitest + Testing Library installed, `npm test` runs and exits pass/fail) — satisfied since the prior session's Task 1.
- **TEST-02** (reducer unit tests for seed-removal, DELETE_ALL_DATA, workout start/finish) — satisfied since the prior session's Task 2.
- **TEST-03** (hold gesture, target-weight field, session bar each have a passing smoke test) — satisfied by this session's Task 3.
- **TEST-04** (`npm run lint` and `npm test` both exit clean in the same run) — satisfied by this session's Task 4.

## Deferred

None. This plan was this phase's entire scope (single-plan phase, per ROADMAP.md).
