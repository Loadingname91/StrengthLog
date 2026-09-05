# Roadmap: FitLog (StrengthLog) — Stabilization Milestone

## Overview

This is a brownfield stabilization milestone on an already-working React + Vite + Capacitor workout tracker, not a greenfield build. The app's core mechanics (routines, active workout logging, stats, CSV import/export, settings) already exist and work. This milestone closes four gaps discovered through real use on a physical Android device: fake seed data polluting a fresh install, a destructive delete action that's one fat-finger tap away from wiping everything, an active-workout experience that goes blank or gets lost when the user navigates away, and zero automated test coverage protecting any of it. The journey moves from making the app trustworthy at rest (clean installs, safe deletion) to making it trustworthy in motion (session continuity matches the app's stated core value), then closes with a full manual interaction sweep and a real test suite so future regressions like these get caught before a device install, not after.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Fresh Install & Safe Deletion** - New installs start completely empty and "Delete all data" requires a deliberate press-and-hold instead of a single tap (completed 2026-09-05)
- [x] **Phase 2: Uninterrupted Workout Sessions** - Active workouts show correct placeholder guidance and survive navigation, backgrounding, and the hardware back button without losing the user's place (completed 2026-09-05)
- [x] **Phase 3: Interaction Quality Audit** - Every control on every screen is manually verified to do what it claims, with defects fixed or explicitly deferred (completed 2026-09-05)
- [x] **Phase 4: Test Suite & Regression Safety Net** - A Vitest + Testing Library suite covers this milestone's riskiest logic and newest features, running clean alongside lint (completed 2026-09-05)

## Phase Details

### Phase 1: Fresh Install & Safe Deletion

**Goal**: A fresh install starts with zero fake data, and the app's most destructive action can no longer be triggered by accident.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, SAFE-01, SAFE-02
**Success Criteria** (what must be TRUE):

  1. On a fresh install (empty `localStorage`), the Home screen, Routines list, and Stats hub show zero routines and zero session history — no seeded demo data appears anywhere in the UI.
  2. An existing user's saved routines, sessions, and settings are byte-for-byte unaffected by this change — the seed path never runs when `localStorage` already holds data.
  3. Tapping "Delete all data" once does nothing destructive — the action only fires after a press-and-hold gesture completes, with a visible progress indicator filling during the hold.
  4. Releasing the hold before it completes cancels the action cleanly — no toast, no state change, no partial deletion.

**Plans**: 2/2 plans complete
Plans:

- [x] 01-01-PLAN.md — Fresh install starts with zero seeded data; existing-user data provably untouched (DATA-01, DATA-02)
- [x] 01-02-PLAN.md — "Delete all data" requires a 1.5s press-and-hold with visible fill; early release cancels silently (SAFE-01, SAFE-02)

### Phase 2: Uninterrupted Workout Sessions

**Goal**: Users can trust the active workout to guide their input correctly and never lose their place, whether they navigate away, background the app, or have no logging history for an exercise yet — this is the milestone's direct delivery of the project's stated core value.
**Mode:** mvp
**Depends on**: None (functionally independent of Phase 1; sequenced after it for delivery order)
**Requirements**: SESSION-01, SESSION-02, SESSION-03, SESSION-04, BUILD-01, BUILD-02
**Success Criteria** (what must be TRUE):

  1. While a workout is active, a persistent floating bar with a live running clock is visible on every screen (Home, Routines, Stats, Settings) — not just inside Active Workout — and tapping it jumps straight back into Active Workout at the current exercise.
  2. Leaving Active Workout via the in-app back control, bottom-nav navigation, or the Android hardware/gesture back never discards the in-progress session — resuming via the mini-bar or the Log tab lands exactly where the user left off.
  3. The elapsed-time clock reflects true wall-clock time even after the app is backgrounded and foregrounded again.
  4. Routine Builder's exercise block editor has an optional target-weight field alongside sets/reps/rest/RIR.
  5. When a block has a target weight set and no historical "last time" data exists yet for that exercise, Active Workout's ghost/placeholder value shows the target weight instead of a blank dash.

**Plans**: 2/2 plans complete

- [x] 02-01-PLAN.md
- [x] 02-02-PLAN.md

**UI hint**: yes

### Phase 3: Interaction Quality Audit

**Goal**: Every interactive control across the app is confirmed to behave as intended, closing the gap between "looks done" and "actually works" that let the pre-milestone bugs slip through.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2 (audits the complete, updated feature surface, including the new deletion gesture, target-weight field, and session bar)
**Requirements**: QA-01, QA-02
**Success Criteria** (what must be TRUE):

  1. Every button, toggle, gesture, and drag handle on every screen (Home, Routines, Routine Builder, Active Workout, Stats hub tabs, Measurements, CSV Import, Export & Insights, Settings) has been manually exercised at least once and confirmed to perform its stated action.
  2. Every defect discovered during the audit is either fixed within this milestone or recorded in PROJECT.md's Context section with an explicit, stated reason for deferring it.

**Plans**: 1/1 plans complete

- [x] 03-01-PLAN.md

**UI hint**: yes

### Phase 4: Test Suite & Regression Safety Net

**Goal**: The codebase has a real, running test suite covering this milestone's highest-risk logic and newest interactive features, so the next regression gets caught by `npm test`, not by a user on a real device.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2, Phase 3 (tests target this milestone's changes, including any fixes that came out of the interaction audit)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):

  1. Vitest + Testing Library are installed and configured, and a test command (e.g. `npm test`) runs the suite successfully.
  2. `src/state/reducer.js` has unit tests covering the seed-removal path, the `DELETE_ALL_DATA` action, and the workout start/finish/session-transition actions, all passing.
  3. The delete-all long-press gesture, the target-weight field, and the persistent session bar each have at least one passing smoke-level interaction test.
  4. `npm run lint` and the new test command both exit clean (zero errors) in the same run.

**Plans**: 1/1 plans complete

- [x] 04-01-PLAN.md

## Progress (v1.0 — Stabilization Milestone)

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fresh Install & Safe Deletion | 2/2 | Complete    | 2026-09-05 |
| 2. Uninterrupted Workout Sessions | 2/2 | Complete    | 2026-09-05 |
| 3. Interaction Quality Audit | 1/1 | Complete    | 2026-09-05 |
| 4. Test Suite & Regression Safety Net | 1/1 | Complete    | 2026-09-05 |

v1.0 shipped 2026-09-05 — all 16 requirements complete. Post-milestone fixes
also landed the same day (drag-gesture backgrounding guard, error boundary,
corrupted-storage backup, test coverage for `schedule.js`/`csvImport.js`/
`selectors.js` — see `PROJECT.md` Key Decisions).

---

# Roadmap: v1.1 — Smart Set Flow

## Overview

This milestone targets how logging actually *feels* mid-set, on a phone, one-handed —
the thing v1.0's core value statement names directly. Three related gaps surfaced
from real use: (1) weight/reps inputs are small and require manual re-tapping
between every field and every set; (2) a block's rest is a single implicit
number, not something the user can see or shape as part of the set sequence
they're authoring; (3) supersets exist in the data model (`type: 'superset'`)
but the two exercises still require manual tab-switching in Active Workout —
nothing actually alternates them or clusters their rest around the pair
rather than each individual set.

The first gap (fast entry) is fully independent of the other two and ships
first as a quick, low-risk win. The other two share one underlying data-model
change — an explicit `sequence` of set/rest (or, for supersets, round/rest)
steps replacing today's flat `sets: N` count + single `rest` value — so they're
one phase with two plans (authoring, then runtime), matching this project's
existing convention of splitting tightly-coupled work into plans rather than
separate phases (see Phase 1 and Phase 2).

**Design decisions locked via discussion on 2026-09-05** (see
`.planning/phases/05-fast-set-entry/05-DISCUSSION-LOG.md` and
`.planning/phases/06-structured-sets/06-DISCUSSION-LOG.md`):
- Rest becomes an explicit, individually-editable row in the set sequence (not just a per-block toggle)
- Merged supersets auto-advance and render as one interleaved flow in Active Workout (not manual tab-switching)
- Fast entry does both auto-advance-focus AND auto-mark-done

## Phases

- [x] **Phase 5: Fast Set Entry** - Weight/reps inputs are bigger and touch-friendly; confirming a field auto-advances to the next one, and a set auto-completes once both values are filled (completed 2026-09-05)
- [ ] **Phase 6: Structured Sets — Rest Rows & Superset Merge** - Rest becomes an explicit, editable row in a block's set sequence; merging exercises into a superset makes Active Workout auto-alternate between them with rest clustered around each full round

## Phase Details

### Phase 5: Fast Set Entry
**Goal**: Logging a set on a phone takes fewer taps — bigger inputs, auto-advancing focus, and automatic completion once both values are in.
**Mode:** mvp
**Depends on**: Nothing (fully independent of Phase 6)
**Requirements**: ENTRY-01, ENTRY-02, ENTRY-03
**Success Criteria** (what must be TRUE):
  1. Active Workout's weight and reps inputs are visibly larger (font size and tap-target height) than today's compact row, without breaking the 3-column set-row layout on a 390px-wide phone viewport.
  2. Confirming a value in the weight field (Enter/keyboard "Next"/blur with a valid number) moves focus to that same set's reps field.
  3. Confirming a value in the reps field moves focus to the next set's weight field; on the last set of the current exercise, it blurs instead of focusing nothing useful.
  4. Once both weight and reps hold valid values for a not-yet-done set, the set is automatically marked done — no separate tap on the checkmark required.
  5. The checkmark button still works as a manual toggle (override an auto-mark, or mark done without filling both fields), and editing a field after auto-completion does not un-mark the set.
**Plans**: 1/1 plans complete
Plans:
- [x] 05-01-PLAN.md — Enlarged inputs, confirm-to-advance focus chain, auto-mark-done (ENTRY-01, ENTRY-02, ENTRY-03)
**UI hint**: yes — resolved inline in `05-CONTEXT.md` (no separate UI-SPEC needed; scope was narrow enough to decide directly)

### Phase 6: Structured Sets — Rest Rows & Superset Merge
**Goal**: A block's set sequence — including rest — is something the user authors and sees explicitly, and a merged superset actually alternates in Active Workout instead of requiring manual tab-switching.
**Mode:** mvp
**Depends on**: Nothing structurally (independent of Phase 5; both touch Active Workout's `SetRow`/exercise-progression code, so sequencing matters for merge conflicts more than logical dependency)
**Requirements**: REST-01, REST-02, REST-03, REST-04, REST-05, SUPER-01, SUPER-02, SUPER-03
**Success Criteria** (what must be TRUE):
  1. In Routine Builder's block editor, the set count is replaced by an explicit, ordered list of set/rest rows; the user can add a rest row (defaulting to Settings' "Default rest (sec)"), remove one, and edit any rest row's duration independently.
  2. Adding a new set via "+ Add Set" automatically appends a rest row after it (matching today's implicit auto-rest behavior), which the user can then remove if they don't want rest there (e.g. a drop set).
  3. Selecting 2+ single-exercise blocks and merging them produces a superset whose sequence alternates the exercises per round, with rest inserted only after a full round (one set from each exercise), not after every individual set.
  4. A routine saved before this milestone (only a `sets` count + one `rest` value, no `sequence`) loads, displays, and runs in Active Workout exactly as it did before — backfilled into the new model transparently, with no user-visible change until they edit that block.
  5. In Active Workout, rest appears as an explicit row in the set list (in addition to/replacing the existing bottom sticky timer for the equivalent moment), reflecting the authored sequence rather than a single implicit per-block number.
  6. In Active Workout, completing a set within a merged superset automatically advances to the next exercise in the round — no manual tab tap required to follow the intended alternating flow.
  7. A merged superset renders as one interleaved view in Active Workout (both exercises' current position visible together), not two separate per-exercise tabs requiring manual switching.
**Plans**: 2 plans, written — ready to execute (06-02 depends on 06-01)
Plans:
- [ ] 06-01-PLAN.md — Data model (`sequence` field + backfill) and Routine Builder authoring UI (REST-01..04, SUPER-01)
- [ ] 06-02-PLAN.md — Active Workout runtime: rest rows in the set list, superset auto-advance and merged rendering (REST-05, SUPER-02, SUPER-03)
**UI hint**: yes — `06-UI-SPEC.md` written and signed off (sequence editor design, merged-superset card, rest-row states)

## Progress (v1.1 — Smart Set Flow)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Fast Set Entry | 1/1 | Complete    | 2026-09-05 |
| 6. Structured Sets — Rest Rows & Superset Merge | 0/2 | Planned — ready to execute | - |
