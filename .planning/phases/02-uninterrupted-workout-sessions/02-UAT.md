---
status: partial
phase: 02-uninterrupted-workout-sessions
source: [02-VERIFICATION.md]
started: 2026-09-05T09:50:00Z
updated: 2026-09-05T09:50:00Z
---

## Current Test

number: -
name: Deferred by user — will test later on a real device
expected: |
  User will manually run both tests below on a real device/browser when convenient and
  report back. Not executed as part of this session (no device/browser available here).
awaiting: user response

## Tests

### 1. Session bar visibility and tap-to-resume on a real device
expected: Bar visible with advancing clock on Home/Routines/Stats/Settings while a workout is active; tapping it returns to the same exercise.
result: [skipped — deferred by user, 2026-09-05]

### 2. Wall-clock accuracy across backgrounding on a real device
expected: Both SessionBar and ActiveWorkout clocks immediately show the correct elapsed time after backgrounding/foregrounding, no stale display.
result: [skipped — deferred by user, 2026-09-05]

## Summary

total: 2
passed: 0
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps

None recorded. Both items deferred, not failed — re-run manually when convenient:
`npm run build && npx cap sync android` then test on-device, or check in a browser build.
