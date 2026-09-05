---
status: testing
phase: 01-fresh-install-safe-deletion
source: [01-VERIFICATION.md]
started: 2026-09-05T09:06:00Z
updated: 2026-09-05T09:06:00Z
---

## Current Test

number: 1
name: Fresh-install empty state on a real device
expected: |
  Clear localStorage (or a fresh install), launch the app, and confirm Home, Routines, and
  Stats hub all show their empty states with zero fake routines/history, and the greeting
  shows the generic "Athlete" placeholder rather than a specific persona.
awaiting: user response

## Tests

### 1. Fresh-install empty state on a real device
expected: No demo routines, sessions, or history visible anywhere on Home, Routines, or Stats hub; greeting shows "Athlete".
result: [pending]

### 2. Hold-to-confirm timing on a real device
expected: Holding "Delete everything" for the full ~1.5s deletes all data and closes the sheet; releasing early cancels cleanly with no deletion and no partial state change.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
