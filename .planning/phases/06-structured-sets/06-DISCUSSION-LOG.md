# Phase 6: Structured Sets — Rest Rows & Superset Merge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 6-Structured Sets
**Areas discussed:** Rest-set shape, superset flow

---

## Rest-set shape

User's original ask: "i should be able to add rest set along with the exercise
that trigger automatically after completion of normal set, when we create
routine there should be option to select them" and "the rest set can have a
default value derived from the rest timer setting."

Today, rest is a single number on a block (`block.rest`) and a rest timer
auto-starts after a set is marked done (`reducer.js`'s `TOGGLE_SET_DONE`,
already true) — but it isn't a visible, individually-editable item the user
authors; it's one implicit duration applied uniformly to the whole block.

### What should a "rest set" actually be, structurally?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit row in the set list | Rest becomes its own row interleaved with sets in both Routine Builder and Active Workout (Set 1 → Rest → Set 2 → Rest → Set 3), individually addable/removable like sets, each with its own duration. | ✓ |
| Per-block toggle only | Keep one rest duration per block, just add an explicit on/off toggle in Routine Builder instead of it being implicit/always-on. | |

**User's choice:** Explicit row in the set list.

**Implication:** this requires an actual data-model change — a per-block
`sequence` of ordered set/rest steps replacing the flat `sets: N` count + single
`rest` value — not just a UI toggle over existing fields. See CONTEXT.md's
`sequence` design.

---

## Superset flow

User's original ask: "the exercise that you select should have option to merge
exercises to create supersets where the sets between the exercises merge and
alternate neatly this includes any rests between them that usually occur only
after 2 sets."

Today, `type: 'superset'` blocks already exist (via `RoutineBuilder.jsx`'s
`groupSuperset()`) and rest already only starts after the *last* exercise in
the pair completes a set (`isLastInPair` in `reducer.js`) — but Active Workout
still requires the user to manually tap between each exercise's chip/tab to
alternate; nothing auto-advances or visually merges them.

### Should Active Workout auto-advance and visually interleave superset exercises, or keep manual tab-switching?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-advance + merged view | Marking exercise A's set done automatically jumps to exercise B's next set; the two exercises render as one interleaved card (A1, B1, A2, B2...) instead of separate tabs. | ✓ |
| Keep manual tab-switching | Leave today's chip-based navigation as-is; only confirm rest timing (already correct). | |

**User's choice:** Auto-advance + merged view.

**Implication:** this is the larger, more invasive half of this phase — it
changes Active Workout's core progression model from "one exercise entry per
`exerciseId`, `currentIndex` selects which one" to a step-based model where a
superset is a single merged unit with its own internal step pointer. Confirmed
scope with the user as "the bigger, more involved change" before proceeding.

---

## Claude's Discretion (raised during design, not asked back to the user)

### Exact `sequence` step vocabulary

Landed on three step types: `{type:'set'}` (single-exercise block),
`{type:'round'}` (superset block — one set of each exercise in the pair, back
to back, no rest between them), and `{type:'rest', seconds}` (either kind of
block). Not asked back to the user — this is the minimal vocabulary that
satisfies both "rest is an explicit interleaved row" and "superset rest fires
only after a full round," without introducing per-set custom rep targets
(which nothing in this request or the existing data model calls for — reps/RIR
targets stay block-level, uniform across all sets, exactly as today).

### Backward-compat migration strategy for existing routines (REST-04)

A routine saved before this milestone has `sets: N` + `rest: R`, no
`sequence`. Decided: backfill lazily (a pure function, not a stored migration)
that derives `sequence` from `sets`/`rest`/`type` whenever a block lacks one —
`N` set-or-round steps with a rest step between each *except* after the last
one. This was not asked back to the user because there is no meaningful
alternative that satisfies REST-04's "loads and behaves exactly as before, no
data loss" — a one-time destructive migration on load risks a persistence bug
class this project has explicitly hardened against before (Phase 1's DATA-02).

### Merged-superset set-count and rest-value precedent when merging

`groupSuperset()` already has a precedent: when merging, the resulting block
keeps the *first* selected block's other fields (rest, rir, etc.) — see
`RoutineBuilder.jsx`'s existing `merged = { ...blocks[first], type: 'superset', exerciseIds: ... }`.
Extending this precedent to `sequence` (keep the first block's round-count and
rest duration, both editable afterward via the same sequence editor) is the
consistent choice, not re-litigated with the user since it's continuing an
established pattern rather than introducing a new one.
