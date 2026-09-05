---
status: partial
phase: 01-fresh-install-safe-deletion
source: [01-VERIFICATION.md]
started: 2026-09-05T09:06:00Z
updated: 2026-09-05T09:15:00Z
---

## Current Test

number: -
name: Deferred by user — will test later on a real device
expected: |
  User will manually run both tests below on a real device/browser when convenient and
  report back. Not executed as part of this session (no device/browser available here).
awaiting: user response

## Tests

### 1. Fresh-install empty state on a real device
expected: No demo routines, sessions, or history visible anywhere on Home, Routines, or Stats hub; greeting shows "Athlete".
result: [skipped — deferred by user, 2026-09-05]

### 2. Hold-to-confirm timing on a real device
expected: Holding "Delete everything" for the full ~1.5s deletes all data and closes the sheet; releasing early cancels cleanly with no deletion and no partial state change.
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
