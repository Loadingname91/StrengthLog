# Phase 1: Fresh Install & Safe Deletion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 1-Fresh Install & Safe Deletion
**Areas discussed:** Empty-state shape & seed code fate, Hold-gesture UX, Hold-gesture reusability

---

## Empty-state shape & seed code fate

### What should a brand-new user's state look like once buildSeed() no longer runs?

| Option | Description | Selected |
|--------|-------------|----------|
| Fully empty | `routines: []`, `routineOrder: []`, `sessions: []`, `goals: []`, `measurements: []` — user builds their first routine from scratch. Matches DATA-01's "zero routines" criterion exactly. | ✓ |
| Empty history, starter routines kept | Keep the 5 example routines so there's something to log against, but zero sessions/goals/measurements. Deviates from DATA-01. | |
| You decide | Claude picks based on DATA-01/DATA-02 criteria. | |

**User's choice:** Fully empty (recommended)

### What happens to the seed generator code (src/lib/seed.js, src/lib/rng.js)?

| Option | Description | Selected |
|--------|-------------|----------|
| Delete both files entirely | No demo data generator left in the codebase. Simplest, no dead code. | ✓ |
| Keep, but unused (dev-only escape hatch) | Leave files in place, just stop calling buildSeed(). Unreferenced code a later audit would flag. | |
| You decide | Claude picks based on codebase cleanliness conventions. | |

**User's choice:** Delete both files entirely

### Should the hardcoded default user name ('Marcus') change now?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is | Not in scope — unrelated to DATA-01/02, a display-name default, not seeded routine/session data. | ✓ |
| Change the default name now | Swap 'Marcus' for a neutral default since buildInitialState() is being touched anyway. | |

**User's choice:** Leave as-is
**Notes:** User confirmed this is out of scope for the phase; can be changed later via Settings if desired.

---

## Hold-gesture UX

### How long should the press-and-hold take?

| Option | Description | Selected |
|--------|-------------|----------|
| ~1.5 seconds | Long enough to be deliberate, short enough not to feel laggy. Common hold-to-confirm duration. | ✓ |
| ~2.5-3 seconds | Slower, harder to trigger by accident, but feels sluggish for a genuine delete. | |
| You decide | Claude picks a standard duration during planning. | |

**User's choice:** ~1.5 seconds (recommended)

### What should the visual hold-progress indicator look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Button fills with color | The danger-red confirm button fills left-to-right (or radial wipe) as you hold. No new UI chrome, fits existing ConfirmSheet style. | ✓ |
| Circular progress ring | A ring/spinner around or inside the button completes as you hold. Needs new SVG/animation work. | |
| You decide | Claude picks based on simplicity + existing visual style. | |

**User's choice:** Button fills with color (recommended)

### Where should the hold gesture live?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the sheet, hold on its confirm button | Tapping "Delete all data" still opens ConfirmSheet (explanatory text stays); "Delete everything" button requires hold instead of tap. | ✓ |
| Remove the sheet, hold directly on the Settings row | Press-and-hold directly on the Settings list row; loses explanatory body text unless shown elsewhere. | |

**User's choice:** Keep the sheet, hold on its confirm button (recommended)

---

## Hold-gesture reusability

### Should hold-to-confirm be generic on ConfirmSheet, or one-off in Settings.jsx?

| Option | Description | Selected |
|--------|-------------|----------|
| Generic opt-in prop on ConfirmSheet | Add a `holdToConfirm` (+ optional `holdMs`) prop to the shared component. Settings passes it for "Delete all data"; Routines/ActiveWorkout keep tap-to-confirm unchanged. Future destructive actions can opt in with one prop. | ✓ |
| One-off in Settings.jsx only | Build hold-to-fill logic local to Settings.jsx, leaving ConfirmSheet untouched. Simpler diff, but logic would be rebuilt from scratch for future use elsewhere. | |

**User's choice:** Generic opt-in prop on ConfirmSheet (recommended)

---

## Claude's Discretion

- Exact fill animation mechanics (CSS transition vs. `requestAnimationFrame`, radial vs. linear wipe direction).
- Pointer/touch event wiring for both Android WebView (touch) and browser dev testing (mouse).
- Exact empty-state default values for `routineMode`, `sequenceIndex`, `scheduleRestartAt`, `weekdayAssignments` — consistent with `defaultWeekdayAssignments([])` and reducer expectations.

## Deferred Ideas

None — discussion stayed within phase scope. The default-user-name change and starter-routine-retention options were both considered and explicitly declined, not deferred to a future phase.
