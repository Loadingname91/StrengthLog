# Phase 6: Structured Sets — Rest Rows & Superset Merge - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase replaces a block's flat `sets: N` count + single `rest` value with
an explicit, ordered `sequence` of steps (set/round + rest), authored in
Routine Builder and run in Active Workout — and makes merged superset blocks
actually alternate exercises automatically in Active Workout instead of
requiring manual tab-switching. It does NOT touch Phase 5's input-sizing/
auto-advance/auto-mark-done work (different concern, same files touched —
merge care needed if built close together, no logical dependency).

Maps to requirements REST-01, REST-02, REST-03, REST-04, REST-05, SUPER-01,
SUPER-02, SUPER-03.

**Two plans** (matching this project's existing convention of splitting
tightly-coupled work by plan rather than phase — see Phase 1, Phase 2):
- **06-01**: Data model (`sequence` field + backfill) + Routine Builder authoring UI
- **06-02**: Active Workout runtime (rest rows in the set list, superset auto-advance + merged rendering)

06-02 depends on 06-01's data model existing; 06-01 has no runtime dependency
and could theoretically ship alone (routines would just carry an unused
`sequence` until 06-02 reads it) — but shipping only one plan is not a
requirement's "done" state, only Phase completion is.

</domain>

<decisions>
## Implementation Decisions

### The `sequence` data model (REST-01, REST-02, SUPER-01)
- **D-01:** Every block gains a `sequence` field: an ordered array of step
  objects. Two step-shapes cover everything this phase needs:
  - `{ type: 'set' }` — one working set, used by `type: 'single'` blocks.
  - `{ type: 'round' }` — one set of *each* exercise in the pair, back to back
    with no rest between them, used by `type: 'superset'` blocks.
  - `{ type: 'rest', seconds: N }` — a rest step, valid after either a `set`
    or a `round` step, in either block type.
  - No per-step rep/RIR/weight targets — those stay block-level (`repMin`,
    `repMax`, `rir`, `targetWeight`), uniform across every set in the block,
    exactly as today. Nothing in this request calls for per-set targets.
- **D-02:** `block.sets` (the old count) is derived, not stored redundantly,
  once `sequence` exists: `sequence.filter(s => s.type !== 'rest').length`.
  `blockTarget()` (`src/lib/format.js`) and any other `block.sets` reader is
  updated to compute this from `sequence` rather than reading a separate
  field, so there is exactly one source of truth (no risk of the two drifting
  out of sync after a rest-row edit changes nothing about set count, or a
  set-row edit does).
- **D-03:** `block.rest` (the old single duration) is fully replaced by the
  per-step `seconds` values in `sequence` — not kept as a fallback/duplicate.
  Any remaining reader of `block.rest` is updated to read the relevant rest
  step's `seconds` instead (see 06-02 for Active Workout's specific reads).

### Backfill for existing routines (REST-04)
- **D-04:** A pure function (e.g. `backfillSequence(block)` in
  `src/lib/schedule.js`-adjacent or a new small `src/lib/blocks.js` — exact
  placement is Claude's discretion at plan time, matching `STRUCTURE.md`'s
  `lib/` convention for framework-free logic) runs whenever a block is read
  without a `sequence`: for `N = block.sets`, produce `N` `set`/`round` steps
  (`round` if `block.type === 'superset'`, else `set`), with a
  `{type:'rest', seconds: block.rest}` inserted between each consecutive pair
  — *not* after the last one (no trailing rest before the block/exercise ends,
  matching what "rest between sets" means colloquially and avoiding an
  unwanted rest firing right as the user is about to move on regardless).
- **D-05:** Backfill is applied lazily at read time (e.g. in
  `buildActiveWorkoutFromRoutine` and wherever Routine Builder loads a block
  for editing), not as a one-time destructive rewrite of persisted state on
  load — mirrors this project's existing backfill pattern for
  `weekdayAssignments`/`scheduleRestartAt` in `buildInitialState()`
  (`src/state/StoreContext.jsx` lines 9-16), which the user has already
  established as the safe way to evolve persisted shape without a migration
  step that could itself have bugs.

### Routine Builder authoring UI (REST-01, REST-02, REST-03, SUPER-01)
- **D-06:** `BlockEditSheet`'s "Sets" numeric input is replaced by a visual,
  ordered list of the block's `sequence` steps: each `set`/`round` step
  renders as a compact labeled row ("Set 1", "Set 2", ... or "Round 1", "Round
  2", ..."); each `rest` step renders as an editable row with a numeric
  seconds input and a remove ("×") button.
- **D-07:** "+ Add Set" appends one new `set`/`round` step AND a
  `{type:'rest', seconds: state.settings.restDefault}` step immediately after
  it (REST-03: new rest defaults from Settings, not a hardcoded value) —
  matching the existing implicit auto-rest-after-a-set behavior the user
  named as the trigger condition. The appended rest is then a normal row the
  user can remove (e.g. for an intentional back-to-back drop set) via the
  same "×" as any other rest row.
- **D-08:** The sequence can never be emptied of its last set/round step (
  mirrors the existing `REMOVE_SET` reducer guard of `ex.sets.length > 1`) —
  removing rows only ever removes rest rows or a non-last set/round.
- **D-09:** Merging blocks into a superset (extending the existing
  `groupSuperset()` in `RoutineBuilder.jsx`) builds a new merged `sequence` of
  `round`/`rest` steps using the *first* selected block's round-count and rest
  duration (continuing this function's existing precedent of keeping the
  first block's other fields — see Discussion Log). `ungroup()` is extended
  symmetrically: splits a superset's `round` steps back into per-exercise
  `set` steps, one new single-type block per exercise, each inheriting the
  same set-count and rest duration the merged block had.

### Active Workout runtime (REST-05, SUPER-02, SUPER-03)
- **D-10:** Rest renders as an explicit row in the set list (inline, between
  set rows) in addition to the existing bottom sticky rest-timer overlay for
  the *currently active* rest — the inline row is the authored-sequence
  display (what's coming, and what's already passed), while the sticky
  overlay remains the live countdown UX for whichever rest is currently
  running. These are complementary, not either/or: the sticky overlay's
  existing countdown/adjust/skip UX (`REST_ADJUST`, `REST_SKIP`) is unchanged.
- **D-11:** For a `type: 'single'` block, Active Workout's per-exercise
  runtime unit gets a `steps` array derived from `block.sequence` (set steps
  become the existing per-set object shape `{weight, reps, rir, done, isPR}`;
  rest steps carry their `seconds`). Progression is a step-index instead of
  today's flat `sets` array with no positional rest awareness.
- **D-12:** For a `type: 'superset'` block, instead of `buildActiveWorkoutFromRoutine`
  producing one `exercises[]` entry per `exerciseId` (today's behavior — see
  `src/state/reducer.js` line ~10), it produces **one merged unit** covering
  both/all exercises in the pair. Each `round` step in `block.sequence`
  expands into N consecutive set-steps (one per exercise in the pair, in
  `exerciseIds` order) within that merged unit's `steps` array, followed by
  the round's rest step if present. Completing a set-step auto-advances the
  merged unit's step pointer to the next one — landing on the *other*
  exercise's set-step immediately (SUPER-02), or on a rest step (which
  behaves exactly as single-block rest does today: starts `restUntil` per
  D-10's sticky overlay).
- **D-13:** The merged unit renders both exercises' identity and current set
  together (SUPER-03) rather than the existing per-exercise-tab card — exact
  visual layout (stacked vs. side-by-side, how the exercise-chip strip at the
  top of Active Workout represents a merged pair as one selectable unit vs.
  two) is Claude's discretion at plan/build time, informed by whatever reads
  clearly on a 390px viewport; the underlying requirement is only that both
  exercises' current position in the round is visible without a manual tap.
- **D-14:** `FINISH_WORKOUT` (`src/state/reducer.js` line ~196) is updated to
  extract only `set`-shaped steps (ignoring `rest` steps entirely) when
  building `session.entries[].sets` — for a merged superset unit, each
  exercise's set-steps are grouped back into their own `entries[]` item by
  `exerciseId`, so the persisted session shape is **unchanged**: still
  `entries: [{ exerciseId, blockId, sets: [...] }]` per exercise, exactly as
  every existing selector (`src/lib/selectors.js`), CSV export
  (`src/lib/csv.js`), and CSV import (`src/lib/csvImport.js`) already expects.
  This is the load-bearing compatibility guarantee of this whole phase — no
  downstream consumer of session history needs to change.

### Claude's Discretion
- Exact placement of the `backfillSequence` helper (new `src/lib/blocks.js`
  vs. extending an existing `lib/` file) — pick whatever keeps `lib/`
  dependency-free per `ARCHITECTURE.md`'s existing constraint (no imports
  back into `state/`).
- Exact visual design of the sequence editor rows and the merged-superset
  Active Workout card — no UI-SPEC has been produced yet for this phase; one
  should be produced (or an equivalent visual pass) before task-level planning
  locks in exact markup, per this project's own `ui_phase`/`ui_safety_gate`
  convention (already used for Phase 1's hold-gesture fill animation and
  Phase 2's session bar).
- Whether the exercise-chip strip at the top of Active Workout needs its own
  visual treatment change for a merged pair (e.g. one combined chip vs. two
  chips visually grouped) — deferred to the UI-SPEC step.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — REST-01..05, SUPER-01..03
- `.planning/ROADMAP.md` — Phase 6 section: goal, success criteria, 2-plan split

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — reducer/state patterns, `lib/` dependency rules
- `.planning/codebase/CONVENTIONS.md` — naming/style, backfill-on-read precedent
- `.planning/codebase/CONCERNS.md` — `reducer.js` is already flagged as large (270 lines); this phase adds meaningfully to it (`buildActiveWorkoutFromRoutine`, `TOGGLE_SET_DONE`, `FINISH_WORKOUT` all get more complex) — worth reassessing the "split into per-domain reducers" fix-approach threshold after this phase, not during it (don't refactor and add a feature in the same change)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/screens/RoutineBuilder.jsx` `groupSuperset()`/`ungroup()` (lines ~55-74)
  — existing merge/split logic to extend, not replace; already handles
  selection validity (`canGroup`: consecutive, all-`single`, ≥2 selected).
- `src/state/reducer.js` `buildActiveWorkoutFromRoutine` (line ~10),
  `isLastInPair` (line ~39), `TOGGLE_SET_DONE` (line ~148), `FINISH_WORKOUT`
  (line ~196) — all four need changes for the step-based model; `isLastInPair`
  in particular already encodes "only the last exercise in a superset pair
  triggers rest," which is the existing partial version of SUPER-01's rest
  rule that the `round`-step model formalizes and extends.
- `src/state/StoreContext.jsx` `buildInitialState()` backfill pattern (lines
  9-16) — the precedent D-05 follows for lazy, non-destructive schema evolution.

### Established Patterns
- Immutable historical sessions (`ARCHITECTURE.md`): `session.entries[].sets`
  is the append-only shape every selector/export/import already depends on —
  D-14 is written specifically to preserve this, not change it.
- `src/lib/` modules are leaf dependencies with no imports back into `state/`
  or `screens/` (`ARCHITECTURE.md`'s stated architectural constraint) — the
  new `backfillSequence` helper must respect this.

### Integration Points
- `src/lib/format.js` `blockTarget(block)` — reads `block.sets` today; needs
  to derive from `sequence` per D-02.
- `src/screens/ActiveWorkout.jsx` — the file 06-02 changes most: exercise-chip
  strip, the `current`/`aw.currentIndex` model, `SetRow` mapping, and the
  sticky rest overlay's `aw.restExerciseIndex`/`restUntil` wiring all need to
  reconcile with the new step-based progression.
- CSV import/export (`src/lib/csv.js`, `src/lib/csvImport.js`) — verify no
  changes needed given D-14's compatibility guarantee; add a regression test
  confirming an imported/exported session round-trips unchanged after this
  phase (these already have test coverage from the post-v1.0 fixes — extend
  rather than duplicate).

</code_context>

<specifics>
## Specific Ideas

- `sequence`: ordered array of `{type:'set'}` / `{type:'round'}` / `{type:'rest', seconds}`.
- New rest rows default from `state.settings.restDefault`.
- Backfill existing routines lazily on read, no destructive migration.
- Superset auto-advances the step pointer; merged view shows both exercises together.
- Session/history data shape (`entries[].sets`) stays exactly as today — no downstream breakage.

</specifics>

<deferred>
## Deferred Ideas

- Per-set custom rep/RIR/weight targets within a block (raised implicitly by
  the "sequence of steps" model, but not asked for — reps/RIR/target weight
  stay block-level and uniform, exactly as today). Revisit only if a future
  request explicitly asks for e.g. a pyramid/drop-set scheme with different
  targets per set.
- Reassessing `reducer.js`'s size/split (per `CONCERNS.md`) — this phase adds
  to it rather than restructuring it; a future milestone's cleanup pass, not
  bundled into a feature phase.

</deferred>

---

*Phase: 6-Structured Sets — Rest Rows & Superset Merge*
*Context gathered: 2026-09-05*
