---
phase: 09-notification-polish
plan: 2
subsystem: notifications
tags: [pending-action-drain, finish-deep-link, battery-guidance, react-hooks]
dependency_graph:
  requires:
    - "09-01 (ACTION_FINISH_TAPPED, PendingActionStore's bound)"
    - "08-02 (effect E, the pending-action pipeline)"
  provides:
    - "useWorkoutNotifications.js effect E — resume-triggered drain, three-way apply() including FINISH_TAPPED"
    - "reducer.js SET_FINISH_REQUESTED"
    - "ActiveWorkout.jsx — hoisted finish()/doFinish()/allSetsLogged (useCallback), finishRequested consumption"
    - "App.jsx Shell — navigates to /workout when a finish was requested from elsewhere"
    - "Settings.jsx — battery-optimization guidance banner"
  affects: []
key_files:
  modified:
    - src/state/useWorkoutNotifications.js
    - src/state/useWorkoutNotifications.test.jsx
    - src/state/reducer.js
    - src/state/reducer.test.js
    - src/screens/ActiveWorkout.jsx
    - src/screens/ActiveWorkout.test.jsx
    - src/App.jsx
    - src/screens/Settings.jsx
tech_stack:
  added: []
  patterns:
    - "FINISH_TAPPED never dispatches FINISH_WORKOUT from the effect layer — it sets a flag; ActiveWorkout.jsx's own finish() (the same function its Finish button calls) decides confirm-sheet-vs-direct-finish, since only that screen knows allSetsLogged"
    - "App.jsx Shell navigates; ActiveWorkout.jsx is the sole reader/clearer of finishRequested — matches this project's 'screens own local UI state' convention exactly"
    - "useCallback for finish()/doFinish() — not previously used in this file, but already an established idiom elsewhere in the codebase (ToastContext.jsx) — adopted here specifically so the new finishRequested effect could list a correct, non-churning dependency instead of omitting one or re-running every render"
key_decisions:
  - "allSetsLogged/finish/doFinish moved above ActiveWorkout.jsx's `if (!aw) return null` guard — the finishRequested effect is a hook and the Rules of Hooks forbid placing hooks after a conditional return; hoisting (with allSetsLogged null-guarded) let the effect call the exact same finish() the in-app button uses instead of duplicating its decision inline."
  - "A pre-existing, unrelated `useState(Date.now())` on this file's first line surfaced a new oxlint purity warning once the surrounding code changed shape (confirmed via git stash: absent on the prior commit, present after the hoist). Fixed to the lazy-initializer form (`useState(() => Date.now())`) rather than left as a new warning — a genuine, free correctness improvement (Date.now() was being called every render, not just on mount) surfaced incidentally by this plan's restructuring, not introduced by it."
  - "Two set-state-in-effect warnings now appear in ActiveWorkout.jsx (was one) — accepted rather than eliminated: forcing this to zero would need either useCallback-wrapping every remaining plain function referenced by effects (disproportionate for this task) or a new ref-based pattern not otherwise used in this file. The new instance is the same justified 'consume an external signal exactly once' shape as the pre-existing one."
metrics:
  duration: "~1 session (planning + implementation, no execution split)"
  completed: 2026-09-06
status: complete-unverified-on-device
---

# Phase 9, Plan 2: Resume Drain + Finish Deep-Link + Battery Guidance Summary

Closes NOTIF-14 (resume-triggered drain), NOTIF-15 (the notification's Finish action lands in the real confirm flow), and NOTIF-17 (battery-manager guidance) on the JS side, completing what 09-01's native work started.

## What Was Built

1. **Effect E drains on `resume`, not just mount.** Phase 8's mount-only drain covers a killed-and-restarted process; it misses the app merely being backgrounded with a frozen (not fully killed) WebView. `CapacitorApp.addListener('resume', () => native.drainPendingActions(apply))`, alongside the existing mount-time drain and live-event listener, closes that gap. `apply()` is now a three-way branch (`REST_SKIP`/`REST_ADJUST`/`FINISH_TAPPED`), still gated by the same workoutId-match guard for all three.

2. **`SET_FINISH_REQUESTED`** (reducer.js) — set when a `FINISH_TAPPED` action is applied. `ActiveWorkout.jsx` hoisted `allSetsLogged`, `finish()`, and `doFinish()` above its `if (!aw) return null` guard (as `useCallback`s, so a new effect could depend on `finish` correctly) and added an effect: on `finishRequested`, clear the flag and call `finish()` — the exact function the in-app Finish button already calls, so the same confirm-sheet-or-direct-finish decision applies regardless of where the tap came from.

3. **`App.jsx`'s `Shell`** navigates to `/workout` when `finishRequested` is true and the app isn't already showing it — the one place guaranteed mounted regardless of route. It only navigates; `ActiveWorkout.jsx` remains the sole reader/clearer of the flag.

4. **Settings gains one guidance line** (NOTIF-17) — plain text pointing users on aggressive OEM battery managers toward "Unrestricted," shown whenever the ongoing notification is enabled. No `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` call, per 09-CONTEXT.md's explicit non-goal.

## Two Things Found During Execution, Not Assumed

- **A real pre-existing inefficiency surfaced by the hoist, not caused by it.** `useState(Date.now())` on `ActiveWorkout.jsx`'s first line calls `Date.now()` on every render (only the first call is ever used) — harmless but wasteful. Restructuring the component triggered oxlint's purity check to newly flag it (confirmed via `git stash`: absent before this plan's changes, present after). Fixed to `useState(() => Date.now())` since the fix was free and correct, not because this plan was scoped to touch it.
- **`useCallback` was the right tool, even though this file didn't use it before.** The alternative to satisfy `exhaustive-deps` for the new `finishRequested` effect was either accepting a missing-dependency warning or wrapping `finish`/`doFinish` so the effect could depend on a stable-unless-actually-changed reference. Chose the latter — it's an idiom already used elsewhere in this codebase (`ToastContext.jsx`), not a new import for a one-off case.

## Verification

`npm test`: 123 → **130/130** (4 new in `useWorkoutNotifications.test.jsx` — resume registration/re-drain, `FINISH_TAPPED` routing with workoutId guard, two-action ordering; 2 new in `reducer.test.js` for `SET_FINISH_REQUESTED`; 2 new in `ActiveWorkout.test.jsx` for both Finish-tap outcomes). `npm run lint`: one new warning (a `set-state-in-effect` instance of the same already-tolerated shape already present once in this file) — the purity and exhaustive-deps warnings this plan's first draft introduced were fixed, not left. `npm run build` and `npx cap sync android` both clean.

## What's Deliberately Not Here

Everything genuinely unverifiable without a device: whether the resume drain actually fires correctly when Android freezes (not kills) a backgrounded WebView, whether tapping Finish on a locked phone actually lands on the confirm sheet, and whether the ducked audio (09-01) actually ducks real music on a real device. These are the user's on-device pass, recorded in `09-02-PLAN.md`'s `<verification>` section.
