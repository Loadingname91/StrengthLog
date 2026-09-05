# Phase 1: Fresh Install & Safe Deletion - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers two independent guarantees:

1. **Clean fresh installs** — on an empty `localStorage`, the app initializes with zero seeded/demo data (no fake routines, no fake session history) on Home, Routines, and Stats. Any existing user's persisted data is untouched — the seed path (now removed) never overwrote real data to begin with, since `buildInitialState()` only falls back to seed data when `loadState()` returns null.
2. **Safe deletion** — "Delete all data" in Settings can no longer be triggered by a single accidental tap. It requires a deliberate press-and-hold gesture with visible progress, and releasing early cancels cleanly with zero side effects.

Maps to requirements DATA-01, DATA-02, SAFE-01, SAFE-02.

</domain>

<decisions>
## Implementation Decisions

### Empty-state shape (DATA-01, DATA-02)
- **D-01:** A fresh install's initial state is fully empty: `routines: []`, `routineOrder: []`, `sessions: []`, `goals: []`, `measurements: []`, `activeWorkout: null`. The user builds their first routine from scratch — no starter routines are kept.
- **D-02:** `src/lib/seed.js` and `src/lib/rng.js` are deleted entirely (not kept behind a flag). No demo-data generator remains in the codebase.
- **D-03:** The hardcoded default user name (`user: { name: 'Marcus' }` in `buildInitialState()`) stays as-is. It's independent of `buildSeed()` and out of scope for DATA-01/02 — not touched by this phase.

### Hold-gesture UX (SAFE-01, SAFE-02)
- **D-04:** Hold duration is ~1.5 seconds — long enough to be clearly deliberate, short enough not to feel broken.
- **D-05:** Visual feedback is the confirm button itself filling with color (left-to-right or radial wipe) as the user holds — no new UI chrome, matches the existing `ConfirmSheet` button style.
- **D-06:** The existing `ConfirmSheet` stays in place (tapping "Delete all data" still opens it, with its explanatory body text: "This permanently removes every workout, measurement, and goal..."). The hold gesture replaces the tap behavior on the sheet's "Delete everything" confirm button — it does not replace the sheet itself.
- **D-07:** Releasing the hold before completion cancels cleanly: the fill resets, no toast fires, no state changes, no partial deletion (per ROADMAP Phase 1 success criteria — already locked, not re-litigated here).

### Hold-gesture reusability
- **D-08:** Hold-to-confirm is built as a generic opt-in capability on the shared `ConfirmSheet` component (e.g. a `holdToConfirm` prop, with an optional duration override) rather than one-off logic inside `Settings.jsx`. `ConfirmSheet`'s other two call sites (`src/screens/Routines.jsx`, `src/screens/ActiveWorkout.jsx`) keep their existing tap-to-confirm behavior unchanged — only `Settings.jsx` passes `holdToConfirm` for "Delete all data."

### Claude's Discretion
- Exact fill animation mechanics (CSS transition vs. `requestAnimationFrame`, radial vs. linear wipe direction) — pick whatever integrates cleanly with Tailwind + the existing button markup.
- Pointer/touch event wiring (`onPointerDown`/`onPointerUp`/`onPointerLeave` vs. separate touch/mouse handlers) to work correctly both on the Android WebView (touch) and in browser dev testing (mouse).
- Exact new `routineMode`/`sequenceIndex`/`scheduleRestartAt`/`weekdayAssignments` default values for the empty state — construct them consistently with what `defaultWeekdayAssignments([])` and existing reducer expectations require, without reintroducing seed data.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — DATA-01, DATA-02, SAFE-01, SAFE-02 (full acceptance criteria)
- `.planning/ROADMAP.md` — Phase 1 section: goal, success criteria, dependencies

### Product context
- `docs/app.md` — full PRD; note existing "long-press" interaction pattern used elsewhere (long-press a goal → edit/delete, long-press a completed set → edit/delete) is a *different* mechanic (contextual menu trigger) from the hold-to-fill confirm gesture this phase introduces — do not conflate the two or try to reuse a shared "long press" hook, none currently exists in the codebase.

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — state layer / reducer patterns, persistence model
- `.planning/codebase/CONVENTIONS.md` — naming, styling (CSS custom properties via `style`, not Tailwind color classes), no-semicolon/single-quote style
- `.planning/codebase/STRUCTURE.md` — where new code goes (`src/lib/`, `src/state/`, `src/components/`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ConfirmSheet.jsx` — the shared confirm-modal component to extend with the `holdToConfirm` prop. Currently a simple tap-button; danger styling already exists via its `danger` prop (`var(--danger)` background).
- `src/state/reducer.js` `DELETE_ALL_DATA` case (line ~252) — already correctly scoped (clears `sessions`, `measurements`, `activeWorkout`, `goals`, `customExercises`, `exerciseNotes`; deliberately keeps `routines`/exercise library). This phase only changes *how* the action is triggered, not what it deletes.
- `src/state/StoreContext.jsx` `buildInitialState()` (lines 9-26) — exact spot to replace `...buildSeed()` with the fully-empty state fields.

### Established Patterns
- `buildInitialState()` already only calls `buildSeed()` in the `else` branch (no persisted state found) — DATA-02's "never runs when localStorage already holds data" guarantee is structurally already true; this phase just changes what the `else` branch returns.
- Theme/danger colors come from CSS custom properties (`var(--danger)`, `var(--surface)`) applied via inline `style`, not Tailwind utility classes — the hold-fill animation should follow this same pattern for color, using CSS transitions/keyframes for the fill motion itself.

### Integration Points
- `src/screens/Settings.jsx` (~line 91) — the only call site that will pass `holdToConfirm` to `ConfirmSheet`.
- `src/screens/Routines.jsx` and `src/screens/ActiveWorkout.jsx` — other `ConfirmSheet` call sites; verify they're unaffected (no `holdToConfirm` prop passed, default remains tap-to-confirm).

</code_context>

<specifics>
## Specific Ideas

- Hold duration: ~1.5 seconds.
- Visual style: the existing red "Delete everything" button fills with color as progress, not a separate progress ring.
- No toast, no partial state change on early release — silent, clean cancel.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Default display name change and starter-routine retention were both raised and explicitly declined/deferred by the user, not scope creep — see Discussion Log.)

</deferred>

---

*Phase: 1-Fresh Install & Safe Deletion*
*Context gathered: 2026-09-05*
