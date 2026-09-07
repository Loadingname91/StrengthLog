---
quick_id: 260906-pnz
slug: resume-cta-labels-and-set-done-checkmark
date: 2026-09-07
status: planned
---

# Quick Task: Resume CTA labels and set-done checkmark glow

Two user-reported UI defects, both cosmetic — no behavior change.

## Defect 1 — "Start Workout" shown while a workout is in progress

**Evidence:** `debug/start workout bug /Screenshot_20260906_172642_FitLog.jpg` — the SessionBar reads
"Workout in progress — Upset A  0:28" while the Next Up card directly above still offers "Start Workout".

**Root cause:** label only. The click handlers are already correct — `Home.jsx:56` and
`WorkoutOverview.jsx:59` both short-circuit to `navigate('/workout')` when `state.activeWorkout`
exists, so no session is ever discarded. Three hard-coded "Start Workout" strings simply never
consult that state: `Home.jsx:112` (Next Up card), `Home.jsx:167` (empty state),
`WorkoutOverview.jsx:111`.

**Fix:** a new pure helper `workoutCtaLabel(activeWorkout, routineId)` in `src/lib/format.js`
(alongside the existing display-string helper `blockTarget`), used at all three sites:

| State | Label |
|---|---|
| No active workout | `Start Workout` |
| Active workout for *this* routine | `Resume Workout` |
| Active workout for a *different* routine | `Resume {routineName}` |

The third case matters: the button navigates to the active workout regardless of which routine's
page you are on, so a bare "Resume Workout" under a different routine's name would misdescribe where
the tap actually goes. `activeWorkout.routineId` and `.routineName` are both present on the object
built by `buildActiveWorkoutFromRoutine` (`reducer.js:63-77`).

## Defect 2 — set-done checkmark reads as a plain dark circle

**Location:** `ActiveWorkout.jsx:471-481`. When `set.done`, the 30px button fills with `var(--accent)`
and shows a white tick, but it has no separation from the surrounding surface — against the dark
theme's `--bg: #201F1D` it reads as a flat dark disc rather than a completion mark.

**Fix:** add a white halo when done — a tight `rgba(255,255,255,0.55)` ring plus a soft outer glow,
applied via `boxShadow`. Ring only, no layout change, so the existing `check-pop` animation is
untouched. Harmless in light mode (a white ring against the near-white `--bg`) and high-contrast in
dark mode, where the complaint originates.

## Verification

- New unit tests for `workoutCtaLabel` covering all three branches, in `src/lib/format.test.js`
- `npm test`, `npm run lint`, `npm run build` all clean
