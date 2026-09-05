# Phase 5: Fast Set Entry - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase changes only how weight/reps are typed in Active Workout — no data
model change, no reducer state-shape change, no interaction with Phase 6's
`sequence` work. It touches exactly one file's rendering/behavior
(`src/screens/ActiveWorkout.jsx`'s `SetRow` and its parent's set-list mapping)
plus one new reducer trigger point (auto-dispatching `TOGGLE_SET_DONE`).

Maps to requirements ENTRY-01, ENTRY-02, ENTRY-03.

</domain>

<decisions>
## Implementation Decisions

### Input sizing (ENTRY-01)
- **D-01:** Weight and reps `<input>`s grow from today's `text-[13px]`/`p-1.5` to a
  visibly larger touch target — target `text-lg` (18px) or larger with `p-2.5`+
  padding, aiming for a ~44-48px tap height (matches standard mobile touch-target
  guidance). The existing `grid-cols-[28px_1fr_1fr_1fr_30px]` row layout stays;
  only the input's internal sizing changes, verified against a 390px-wide
  viewport (this project's established phone-width baseline, per its Playwright
  verification pass and `max-w-[480px]` shell).
- **D-02:** The "Set/Last/Weight/Reps" header row and RIR chips keep their
  current smaller size — only the two live-entry inputs (Weight, Reps) grow.
  Making the RIR chips or checkmark bigger too is out of scope unless it turns
  out visually necessary once built (Claude's Discretion at build time).

### Auto-advance focus (ENTRY-02)
- **D-03:** Advance fires on an explicit confirm action — Enter keypress,
  the mobile keyboard's "Next"/"Done" action (wire `enterKeyHint="next"` on
  Weight, `enterKeyHint={isLastSet ? 'done' : 'next'}` on Reps), or blur with a
  non-empty value — never on every keystroke (see Discussion Log: a free-form
  number field can't support keystroke-level advance without breaking
  multi-digit entry).
- **D-04:** Weight's confirm moves focus to that same set's Reps input. Reps'
  confirm moves focus to the *next set's* Weight input; if there is no next set
  (last set of the current exercise), it blurs instead (`inputEl.blur()`),
  dismissing the keyboard rather than focusing nothing.
- **D-05:** Refs need to span across `SetRow` boundaries (Reps of set N →
  Weight of set N+1), so input refs are lifted to the parent exercise-card
  component (`ActiveWorkout`'s `current.sets.map(...)` in `src/screens/ActiveWorkout.jsx`
  around line 167) rather than kept local to each `SetRow` — e.g. a
  `weightRefs`/`repsRefs` array of refs (or a single `Map`) indexed by
  `setIndex`, passed down as a `focusNext` callback prop.

### Auto-mark-done (ENTRY-03)
- **D-06:** Once a set's Weight and Reps both hold valid values
  (`Number.isFinite(parseFloat(weight))` / `Number.isFinite(parseInt(reps,10))`,
  matching the exact validation already used in `reducer.js`'s `TOGGLE_SET_DONE`
  PR-detection logic) and the set is not already `done`, dispatch
  `TOGGLE_SET_DONE` automatically. Trigger point: the confirm action (blur/Enter)
  of whichever field is completed *second* — not a `useEffect` watching both
  fields on every render, to avoid firing mid-keystroke.
- **D-07:** The manual checkmark button (`TOGGLE_SET_DONE` tap target) is
  unchanged — it remains available to undo an auto-mark or to mark a set done
  without both fields filled. Auto-mark is one-directional (not-done → done
  only); editing a field afterward never auto-un-marks it, matching the
  existing precedent that fields stay editable regardless of `done` state.
- **D-08:** Auto-mark-done and auto-advance-focus compose naturally: filling
  Reps (the field usually completed second) both marks the set done AND
  advances focus to the next set's Weight in the same action — no ordering
  conflict, since both are triggered off the same confirm event on whichever
  field is filled last.

### Claude's Discretion
- Exact Tailwind size classes/padding values for the enlarged inputs — pick
  whatever reads clearly bigger without breaking the row's horizontal fit on a
  390px viewport; verify visually (or via the same Playwright-in-Chromium
  approach already used for this project's UAT) before considering this phase
  UI-verified.
- Whether the ghost-value `fillGhost` behavior (existing: tapping an empty
  field fills it with the last session's value, pre-selected) needs any
  adjustment for the new auto-advance flow — likely not, since `fillGhost`
  already fires on `onFocus`, which still happens before the user types over
  it; verify no double-fire/race with the new confirm-triggered advance logic.
- Whether "Weight" needing a confirm action before advancing conflicts with a
  user who deliberately wants to skip straight to Reps without confirming a
  ghost-filled Weight value — if `fillGhost` already populated Weight on focus,
  a user re-focusing Reps directly (tapping it) should still work exactly as
  advancing would; auto-advance is additive, not the only way to move between
  fields.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — ENTRY-01, ENTRY-02, ENTRY-03
- `.planning/ROADMAP.md` — Phase 5 section: goal, success criteria, dependencies (none — independent of Phase 6)

### Codebase maps
- `.planning/codebase/CONVENTIONS.md` — no-semicolon/single-quote style, CSS custom properties via `style` not Tailwind color classes
- `.planning/codebase/ARCHITECTURE.md` — reducer/dispatch pattern for `TOGGLE_SET_DONE`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/screens/ActiveWorkout.jsx` `SetRow` (line ~245) — the exact component to
  modify: `weightPlaceholder`/`fillGhost`/`setField` already exist and stay;
  only sizing, ref wiring, and the two new confirm-triggered behaviors are added.
- `src/state/reducer.js` `TOGGLE_SET_DONE` (line ~148) — already contains the
  exact weight/reps validity check (`Number.isFinite(weight) && Number.isFinite(reps) && weight > 0 && reps > 0`)
  to mirror for the auto-mark trigger condition, and already handles PR
  detection and rest-timer start as a side effect of being marked done — auto-
  mark-done gets these side effects for free by dispatching the same action.

### Established Patterns
- `fillGhost` (existing, `SetRow`) already demonstrates this project's pattern
  for programmatic focus/selection: `requestAnimationFrame(() => inputEl?.select())`
  — the new auto-advance logic should follow the same `requestAnimationFrame`-
  deferred-focus pattern for consistency and to avoid focus-during-render issues.
- Numeric parsing is already guarded with `Number.isFinite` checks before use
  throughout `reducer.js` (per `CONVENTIONS.md`'s documented Error Handling
  pattern) — the auto-mark validity check should reuse this exact style, not
  introduce a new validation helper.

### Integration Points
- No reducer action shape changes — `TOGGLE_SET_DONE`'s payload
  (`{ exerciseIndex, setIndex }`) is dispatched exactly as today, just from an
  additional call site (an input's confirm handler) instead of only the
  checkmark button's `onClick`.
- No interaction with Phase 6 — Phase 6 changes `block.sequence`/the exercise
  progression model; this phase only touches how a single already-existing
  `set` object's two fields are typed into. Both phases touch `ActiveWorkout.jsx`,
  so if executed close together, rebase/merge care is needed, but there is no
  logical dependency either direction.

</code_context>

<specifics>
## Specific Ideas

- Bigger inputs: aim for a ~44-48px touch target, larger font, same 3-column layout.
- Confirm-to-advance: Enter/keyboard-Next/blur, not every keystroke.
- Weight confirm → focus Reps (same set). Reps confirm → focus next set's Weight, or blur on the last set.
- Auto-mark-done fires on the same confirm event as auto-advance, off whichever field is completed second.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Fast Set Entry*
*Context gathered: 2026-09-05*
