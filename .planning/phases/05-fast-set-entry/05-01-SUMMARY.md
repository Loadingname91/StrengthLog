---
phase: 05-fast-set-entry
plan: 1
subsystem: active-workout
tags: [fast-entry, focus-management, auto-complete]
dependency_graph:
  requires: []
  provides:
    - "Enlarged, touch-friendly weight/reps inputs in Active Workout"
    - "Confirm-to-advance focus chain across a set list"
    - "Auto-mark-done once both fields hold valid values"
  affects:
    - src/screens/ActiveWorkout.jsx
tech_stack:
  added: []
  patterns:
    - "Confirm-to-advance via onKeyDown(Enter)/onBlur, never onChange — the only viable pattern for a free-form number field (advancing on every keystroke would break multi-digit entry)"
    - "Re-entrancy guard (confirmingRef) for a confirm handler whose own side effect (shifting real DOM focus) can synchronously re-trigger itself"
key_files:
  modified:
    - src/screens/ActiveWorkout.jsx
  created:
    - src/screens/ActiveWorkout.test.jsx
decisions:
  - "confirmWeight/confirmReps call .focus() directly (not requestAnimationFrame-deferred) — the deferral bought nothing here (unlike fillGhost's legitimate need to defer until after a value+select() render) and using it caused avoidable async timing complexity in tests"
  - "Found and fixed a real bug during testing, not just a test artifact: once a field has genuinely received DOM focus (e.g. reps, after the first auto-advance), shifting focus away from it fires a real native blur — which re-enters that same field's own onBlur handler synchronously before the outer call returns. Without a guard, this double-dispatches TOGGLE_SET_DONE and cancels itself back to not-done. Fixed with a per-row confirmingRef non-reentrancy guard, covered by a dedicated regression test."
  - "Test harness uses useSyncExternalStore to bridge the real reducer into the mocked useStore() — the React-sanctioned pattern for this exact problem (external mutable state read reactively), chosen after an initial useReducer+module-mutation approach worked but tripped an oxlint immutability warning, and a manual re-render-on-dispatch approach caused real 'Cannot update an unmounted root' crashes from nested synchronous renders during event handling"
metrics:
  duration: "~55 min"
  completed: 2026-09-05
status: complete
---

# Phase 5 Plan 1: Fast Set Entry Summary

Implemented all three of Phase 5's requirements in `src/screens/ActiveWorkout.jsx`'s `SetRow` and its parent's set-list mapping — bigger inputs, confirm-to-advance focus chaining, and auto-mark-done — with no data model or reducer action-shape changes.

## What Was Built

1. **Enlarged inputs (ENTRY-01)** — Weight/Reps inputs grew from `text-[13px] p-1.5` to `text-lg p-2.5` (~50px effective touch height, confirmed in a real browser check), matching standard mobile touch-target sizing. Everything else in the row (Set/Last labels, RIR chips, checkmark) is unchanged size.

2. **Confirm-to-advance focus chain (ENTRY-02)** — Input refs were lifted from `SetRow` to the parent (`weightRefs`/`repsRefs`, keyed by `setIndex`). Confirming Weight (Enter or blur, with a non-empty value) focuses that set's Reps; confirming Reps focuses the next set's Weight, or blurs on the last set. `enterKeyHint="next"`/`"done"` wires the mobile keyboard's action-key label. Advance fires only on an explicit confirm action, never on every keystroke — a free-form number field can't support keystroke-level advance without breaking multi-digit entry (typing "12" would jump away after "1").

3. **Auto-mark-done (ENTRY-03)** — Once a set's weight and reps both pass the exact validity check `reducer.js` already uses for PR detection, and the set isn't already done, the same `TOGGLE_SET_DONE` action the checkmark button dispatches fires automatically — so PR detection and rest-timer start (both existing reducer side effects) apply for free. The checkmark remains a full manual override; auto-mark never un-marks a set.

## Bug Found and Fixed During Testing

Writing the regression test for "does a second auto-advance affect an earlier set" surfaced a real bug, not a test artifact: once a field has genuinely received DOM focus (which happens after the *first* auto-advance in any session), programmatically shifting focus away from it fires a real native `blur` event — which re-enters *that same field's* `onBlur` handler synchronously, before the outer confirm call has returned. Without a guard, this dispatched `TOGGLE_SET_DONE` twice in the same batch, toggling a set done then immediately back to not-done. Fixed with a per-row `confirmingRef` non-reentrancy guard (set `true` before the focus-shifting call, `false` after) — covered by a dedicated test that chains two consecutive auto-advances and asserts the first set's `done` state survives the second.

## Verification

- `npm test`: **64/64 tests passing** (5 new in `ActiveWorkout.test.jsx`, including the reentrancy regression test).
- `npm run lint`: same 11 pre-existing warnings, zero new ones (two initial false-positive-looking warnings — a ref-access-during-render flag on `onKeyDown={onEnterKey(fn)}` — were resolved by inlining plain named handlers instead of an immediately-invoked higher-order wrapper).
- `npm run build`: succeeds.
- **Real browser check** (Chromium via this project's established Playwright-verification approach, not code-reading): typed a weight, pressed Enter → focus moved to Reps; typed reps, pressed Enter → the set auto-marked done (checkmark's `check-pop` state) and focus moved to the next set's Weight. 5/5 checks passed.

## Deferred

None — this plan was this phase's entire scope.
