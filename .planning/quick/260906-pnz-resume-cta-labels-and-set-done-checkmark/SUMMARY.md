---
quick_id: 260906-pnz
slug: resume-cta-labels-and-set-done-checkmark
date: 2026-09-07
status: complete
---

# Summary: Resume CTA labels and set-done checkmark glow

Both defects were cosmetic. No behavior changed — the resume *logic* was already correct in both
screens; only the labels lied about it.

## What shipped

**1. `workoutCtaLabel(activeWorkout, routineId)` — `src/lib/format.js`**

New pure helper next to the existing `blockTarget` display helper. Three branches:
no active workout → `Start Workout`; active workout for this routine → `Resume Workout`;
active workout for a different routine → `Resume {routineName}`.

Wired into all three previously hard-coded sites:

- `src/screens/Home.jsx` — Next Up card button
- `src/screens/Home.jsx` — empty-state ("Log your first workout") button
- `src/screens/WorkoutOverview.jsx` — primary CTA

`WorkoutOverview`'s `~{n}m` duration badge is now hidden while a workout is in progress — the
estimate describes a fresh run and is meaningless once you are mid-session.

**2. Set-done checkmark halo — `src/screens/ActiveWorkout.jsx`**

The completed-set button gains `boxShadow: 0 0 0 2px rgba(255,255,255,0.55), 0 0 12px 2px
rgba(255,255,255,0.28)` plus a 180ms ease-out transition. Ring only — no layout change, so the
existing `check-pop` keyframe animation is untouched.

## Verification

- `npm test` — 133 passed across 15 files (130 baseline + 3 new `workoutCtaLabel` cases)
- `npm run lint` — 9 warnings, all pre-existing; none in the touched lines
- `npm run build` — clean, 5.34s

Not verified on a device: the checkmark halo's appearance in dark mode is the whole point of the
change, and only a real phone confirms it reads as intended. The reported screenshot came from a
dark-theme device.

## Notes

The "different routine" branch is the non-obvious one. Both `startWorkout` handlers navigate to the
*active* session regardless of which routine's page hosts the button, so a bare "Resume Workout"
under a different routine's name would have misdescribed where the tap goes. Naming the routine
keeps the label honest.
