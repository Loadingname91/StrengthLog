---
phase: 06-structured-sets
plan: 2
subsystem: active-workout
tags: [superset-runtime, rest-rows, reducer-refinement]
dependency_graph:
  requires: ["06-01: block.sequence data model"]
  provides:
    - "One merged runtime unit per superset block, sets interleaved by round"
    - "restAfter-driven rest triggering, generalized from single/superset special-casing"
    - "Inline rest rows in Active Workout's set list (upcoming/active/passed)"
    - "Superset auto-advance via the same focus chain Phase 5 built, no new navigation state"
  affects:
    - src/state/reducer.js
    - src/screens/ActiveWorkout.jsx
tech_stack:
  added: []
  patterns:
    - "restAfter: an array parallel to sets (not a nested step-type union) — a documented refinement of 06-CONTEXT.md's D-11/D-12 sketch, found simpler while writing the actual reducer code"
    - "exerciseIndex tag per set — the same mechanism serves single blocks (always 0) and supersets (cycling 0..N-1) uniformly, letting FINISH_WORKOUT/TOGGLE_SET_DONE/ADD_SET/REMOVE_SET share one code path instead of branching everywhere"
key_files:
  modified:
    - src/state/reducer.js
    - src/state/reducer.test.js
    - src/screens/ActiveWorkout.jsx
    - src/screens/ActiveWorkout.test.jsx
decisions:
  - "Refined 06-CONTEXT.md's D-11/D-12 (a nested step-type union with a step-index pointer) into a flatter design: sets stays the same array shape reducer actions already index into, plus a parallel restAfter array and an exerciseIndex tag. This is a smaller diff against the existing reducer and means SUPER-02 ('auto-advance across exercises') needs no new navigation state at all — it's Phase 5's confirm-to-advance chain operating over a longer, correctly-ordered array. Documented here per this project's convention of recording such calls (see Phase 3's self-review catch)."
  - "The single-exercise-only help/notes ('?') button is omitted for merged superset units — no per-exercise notes UI was specified for a merged pair in 06-UI-SPEC.md; a documented scope trim, not a silent gap."
  - "restTotalSec added to activeWorkout state (set once when TOGGLE_SET_DONE starts a rest) — replaces reading a now-nonexistent single ex.rest value at render time; unaffected by REST_ADJUST, matching today's existing behavior of a static ring-total baseline."
metrics:
  duration: "~65 min"
  completed: 2026-09-05
status: complete
---

# Phase 6 Plan 2: Active Workout Runtime Summary

Implements REST-05, SUPER-02, and SUPER-03 — the last requirements of the v1.1 "Smart Set Flow" milestone. This is where Plan 1's `sequence` data model actually changes what happens when logging a real workout.

## What Was Built

1. **`expandUnit(block)`** (`reducer.js`) replaces the old per-exerciseId expansion. A superset block now produces **one merged unit** (not one per exercise) whose flat `sets` array interleaves every exercise's sets in round order, each tagged with `exerciseIndex` (always `0` for single blocks; cycling `0..N-1` for an N-exercise superset). A parallel `restAfter` array holds the rest duration to start after each position, or `null` — generalizing what `pairIndex`/`pairSize`/`isLastInPair` used to special-case for supersets only into one mechanism that works identically for both block types. `isLastInPair` is deleted.

2. **Reducer actions updated** to read `restAfter`/`exerciseIndex` instead of `ex.rest`/`pairIndex`: `TOGGLE_SET_DONE`'s rest trigger and PR-lookup exercise ID; `ADD_SET`/`REMOVE_SET` now add/remove one full round (not one set) for a superset unit, keeping the exerciseIndex alternation intact; `FINISH_WORKOUT` groups a merged unit's sets back into one session entry per exercise by `exerciseIndex` — `session.entries[].sets` is byte-for-byte the same shape as before this phase, confirmed by the unchanged `selectors.test.js`/`csvImport.test.js` passing.

3. **Active Workout rendering**: a merged superset unit renders as one interleaved flow — both exercises' current round visible together, grouped into a `var(--surface-alt)` "Round N" block with each exercise's row labeled by name, exactly per `06-UI-SPEC.md` section C. Rest renders as an inline row (`RestRow`, three states: upcoming/active/passed) in addition to the existing sticky countdown overlay, per section B. The exercise-chip strip shows one chip per unit (joined exercise names for a superset). The single-exercise-only help/notes button is omitted for merged units.

## The Key Simplification (documented as a plan-time refinement)

`06-CONTEXT.md` originally sketched a nested step-type model with its own step-index pointer for tracking position within a merged unit. Writing the actual reducer code surfaced a simpler design: keep `sets` as the same flat array every existing action already indexes into, and add `restAfter` + `exerciseIndex` alongside it. This means **SUPER-02's "auto-advance across exercises" needed no new code at all** — Phase 5's confirm-to-advance focus chain (built for consecutive sets of one exercise) already crosses into the paired exercise's row correctly, because it just walks the next position in what is now a longer, round-ordered array. Verified directly in a real browser: confirming the first exercise's reps in a round focuses the second exercise's weight field, with zero superset-specific focus logic.

## Verification

- `npm test`: **84/84 passing** (5 new superset cases in `reducer.test.js` — merged-unit shape, round-only rest trigger, per-exercise `FINISH_WORKOUT` grouping, round-aware `ADD_SET`/`REMOVE_SET`; 4 new in `ActiveWorkout.test.jsx` — both names + Round label render, no help button, and the SUPER-02 focus-chain check). `selectors.test.js`/`csvImport.test.js` pass unchanged, confirming the D-14 session-shape compatibility guarantee holds.
- `npm run lint`: 9 warnings — one **fewer** than the pre-existing baseline (removing the now-unused `sessions` parameter from `buildActiveWorkoutFromRoutine` during the rewrite incidentally fixed a pre-existing lint warning).
- `npm run build`: succeeds.
- **Real browser check** (Chromium, full end-to-end): built a routine with a single exercise (Back Squat) plus a Bench Press + Barbell Row superset; started the workout; logged Squat's sets; jumped to the merged superset via its single combined chip; confirmed both names and "Round 1" render, no help button appears; typed and confirmed the first exercise's reps and watched focus land on the second exercise's weight field (SUPER-02); confirmed no rest starts after only the first exercise but does after the second, with the correct 120s total; confirmed the inline rest row appears alongside the sticky overlay; finished the workout and confirmed it appears in session history. **10/10 checks passed** (one initial failure was a test-setup leak — Squat's own rest still counting down from an earlier set — not an app bug; fixed by skipping rest between test steps).

## Deferred / Known Limitations

- Target weight remains a single block-level value, applied identically to every exercise in a superset pair — a pre-existing limitation from Phase 2's target-weight feature (not introduced or fixed by this phase); noted here since it's more visible now that supersets render together, but out of this milestone's scope.
- The "active" rest row's state detection uses a duration-match heuristic (`aw.restTotalSec === restAfter[si]`) rather than tracking exactly which position triggered the current countdown; correct for the overwhelming common case (one active rest at a time) but could theoretically mis-highlight if two rest positions in the same unit share an identical duration and are both otherwise eligible. Not worth additional reducer state for this cosmetic edge case.

This completes v1.1 "Smart Set Flow" — all of ENTRY-01..03, REST-01..05, and SUPER-01..03 are now shipped.
