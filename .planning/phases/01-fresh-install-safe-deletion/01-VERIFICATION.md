---
phase: 01-fresh-install-safe-deletion
verified: 2026-09-05T09:05:00Z
status: human_needed
score: 3/5 must-haves verified
behavior_unverified: 2
behavior_unverified_items:
  - truth: "Holding 'Delete everything' for the full ~1.5s deletes all data and closes the sheet; releasing before 1.5s cancels cleanly with no toast, no partial state change, and no deletion."
    test: "In a real browser/Android WebView: press-and-hold the delete button for the full 1.5s and confirm data is wiped; separately, press and release before 1.5s and confirm nothing is deleted."
    expected: "Full hold triggers deletion + sheet close; early release cancels with zero state change."
    why_human: "Pointer timing and the CSS fill animation can't be exercised by static code reading — this project has no test runner yet (Phase 4 adds one)."
  - truth: "On a fresh install (empty localStorage), Home, Routines, and Stats hub all show zero routines and zero session history — no seeded demo data appears anywhere in the UI."
    test: "Clear localStorage on a real device/browser, launch the app, and visually confirm all three screens render their empty states with no leftover demo content."
    expected: "Home/Routines/Stats hub show their existing empty-state branches; no fake routines or history visible anywhere."
    why_human: "No browser/device available in this execution environment to load the app and inspect rendered DOM; verified structurally (empty-state literal, no seed import) but not visually."
---

# Phase 1: Fresh Install & Safe Deletion Verification Report

**Phase Goal:** A fresh install starts with zero fake data, and the app's most destructive action can no longer be triggered by accident.
**Verified:** 2026-09-05T09:05:00Z
**Status:** human_needed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On a fresh install, Home/Routines/Stats hub show zero routines and zero history — no seeded demo data | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `buildInitialState()`'s fresh-install branch returns explicit empty arrays/objects for `routines`, `sessions`, `measurements`, `goals`, `customExercises`; `src/lib/seed.js` and `src/lib/rng.js` deleted; no remaining `buildSeed`/seed imports anywhere in `src/` (`StoreContext.jsx:17-36`). Visual confirmation on a real device not performed. |
| 2 | An existing user's persisted data is returned byte-for-byte unchanged — the empty-state path never runs when localStorage already holds data | ✓ VERIFIED | `if (persisted) { ...backfill checks...; return persisted }` branch in `StoreContext.jsx:11-16` is structurally identical to pre-phase code — only two pre-existing backfill checks, no new logic inserted before `return persisted`. |
| 3 | "Delete all data" requires a press-and-hold gesture with a visible hold-progress indicator, not a single tap | ✓ VERIFIED | `Settings.jsx:97` passes `holdToConfirm` to `ConfirmSheet`; when true, the confirm button (`ConfirmSheet.jsx`) has no `onClick`, only `onPointerDown={startHold}`, and renders a width-animated fill div (`holdPct`/`HOLD_DURATION_MS` transition) as the visible progress indicator. |
| 4 | Releasing the hold before it completes cancels the action — no data loss, no partial delete | ✓ VERIFIED | `onConfirm()` is only ever invoked from the `setTimeout` scheduled in `startHold` (`ConfirmSheet.jsx`); `cancelHold` (wired to `onPointerUp`/`onPointerLeave`/`onPointerCancel`) calls `clearTimeout` before the 1500ms elapses, so an early release makes the timer never fire. No dispatch occurs outside that single timeout callback. | 
| 5 | Holding 'Delete everything' for the full ~1.5s deletes all data and closes the sheet; releasing before 1.5s cancels cleanly with no toast, no partial state change, and no deletion | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code path confirmed correct by static reading (see #4), but the actual timed interaction (real 1.5s hold vs. early release, on-device) was not exercised — no test runner exists yet in this project (Phase 4 adds Vitest). |

**Score:** 3/5 truths verified; 2 present + wired but behavior-unverified (flagged for human/device verification — not exercisable by static reading or an automated suite that doesn't exist yet).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/state/StoreContext.jsx` | `buildInitialState()` fresh-install branch returns empty-state literal | ✓ EXISTS + SUBSTANTIVE | 12-field explicit empty-state object, `persisted` branch untouched |
| `src/lib/seed.js` | Deleted | ✓ DELETED AS EXPECTED | File removed, no remaining references anywhere in `src/` |
| `src/lib/rng.js` | Deleted | ✓ DELETED AS EXPECTED | File removed, no remaining references anywhere in `src/` |
| `src/components/ConfirmSheet.jsx` | Opt-in `holdToConfirm` prop driving a 1500ms hold-to-fill gesture | ✓ EXISTS + SUBSTANTIVE | `holdToConfirm` prop, `startHold`/`cancelHold`, fill div, backgrounding-abort effect, open-reset effect |
| `src/screens/Settings.jsx` | `holdToConfirm` wired on "Delete all data" only | ✓ WIRED | `Settings.jsx:97` passes `holdToConfirm`; `Routines.jsx`/`ActiveWorkout.jsx` call sites unchanged, no `holdToConfirm` prop |

**Artifacts:** 4/4 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `Settings.jsx` "Delete all data" button | `ConfirmSheet` hold gesture | `holdToConfirm` prop | ✓ WIRED | `Settings.jsx:97` |
| `ConfirmSheet` hold completion | `DELETE_ALL_DATA` dispatch | `onConfirm` callback → `dispatch({ type: 'DELETE_ALL_DATA' })` | ✓ WIRED | `Settings.jsx:99` |
| `DELETE_ALL_DATA` reducer case | Confirmation dialog copy ("Routines and the exercise library are kept") | `reducer.js` field list vs. `Settings.jsx:94` body text | ✓ WIRED (fixed) | `customExercises`/`exerciseNotes` removed from the wipe list during code-review fix (commit `38388b5`) — copy now matches behavior |
| App backgrounding (`visibilitychange`/`blur`) | Hold-timer abort | `document`/`window` listeners in `ConfirmSheet.jsx` | ✓ WIRED (fixed) | Added during code-review fix (commit `98d7fff`) |

**Wiring:** 4/4 connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|-----------------|
| DATA-01: zero seeded/demo data on fresh install | ✓ SATISFIED | - |
| DATA-02: seed removal doesn't affect existing users | ✓ SATISFIED | - |
| SAFE-01: hold-to-confirm gesture with visible progress indicator | ✓ SATISFIED | - |
| SAFE-02: releasing early cancels, no partial delete | ✓ SATISFIED | - |

**Coverage:** 4/4 requirements satisfied

## Anti-Patterns Found

None. No stubs, placeholders, or TODOs introduced by this phase's changes.

## Human Verification Required

### 1. Fresh-install empty state on a real device
**Test:** Clear app data / uninstall-reinstall (or clear `localStorage` in a browser build), launch the app, and visually confirm Home, Routines, and Stats hub all show their empty states with zero fake data.
**Expected:** No demo routines, sessions, or history visible anywhere; greeting shows the generic "Athlete" placeholder, not a specific persona.
**Why human:** No browser/device available in this execution environment to render and inspect the app.

### 2. Hold-to-confirm timing on a real device
**Test:** On the "Delete all data" sheet, hold the button for the full ~1.5s and confirm deletion occurs; separately, press and release early and confirm nothing is deleted.
**Expected:** Full hold deletes and closes the sheet; early release cancels cleanly with no state change.
**Why human:** Pointer-timing interaction and CSS fill animation require a real input device; this project has no automated test runner yet (planned for Phase 4).

## Gaps Summary

**No blocking gaps found.** Phase goal achieved at the code level; two behavior-dependent truths await on-device confirmation (tracked above), consistent with this project having no test suite until Phase 4.

### Non-Critical Gaps (Deferred, documented in 01-REVIEW-FIX.md)

1. **WR-04: Android hardware back button has no awareness of an open ConfirmSheet**
   - Issue: Pressing back while the delete-all sheet is open triggers route navigation instead of a clean sheet-cancel.
   - Impact: Limited — navigation still incidentally unmounts/closes the sheet without deleting anything; no data-loss risk, just an inconsistent dismiss path.
   - Recommendation: Defer to a dedicated phase/plan — fixing correctly requires a shared modal-stack mechanism touching `App.jsx` and every `ConfirmSheet` call site, out of proportion for this phase's two plans.
2. **IN-01/IN-02 (Info, out of fix scope by default):** no keyboard equivalent for the hold gesture; `holdPct` naming implies granular progress but is binary. Both are pre-existing-style polish items, not correctness issues.

## Verification Metadata

**Verification approach:** Goal-backward (derived from ROADMAP.md phase goal + PLAN.md must_haves), performed inline (no verifier subagent spawned, per project preference)
**Must-haves source:** 01-01-PLAN.md and 01-02-PLAN.md frontmatter
**Automated checks:** `npm run build` and `npm run lint` both pass (exit 0) as of the latest commit
**Human checks required:** 2 (see above)
**Total verification time:** ~10 min

---
*Verified: 2026-09-05T09:05:00Z*
*Verifier: Claude (inline, no subagent)*
