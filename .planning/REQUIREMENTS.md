# Requirements: FitLog (StrengthLog)

**Defined:** 2026-09-05
**Core Value:** Logging a workout mid-session must be fast, reliable, and never lose data.

## v1 Requirements

Requirements for this stabilization milestone. Each maps to a roadmap phase.

### Data

- [x] **DATA-01**: App launches with zero seeded/demo data — no fake routines, no fake session history — on a fresh install (empty `localStorage`)
- [x] **DATA-02**: Removing seed data does not affect any user who already has saved data — the seed path only ever ran when `localStorage` was empty

### Safety

- [x] **SAFE-01**: "Delete all data" requires a press-and-hold gesture with a visible hold-progress indicator, not a single tap, before the destructive action fires
- [x] **SAFE-02**: Releasing the hold before it completes cancels the action — no data loss, no partial delete

### Routine Builder

- [x] **BUILD-01**: Routine Builder's exercise block editor has an optional target-weight field alongside sets/reps/rest/RIR
- [x] **BUILD-02**: When a block has a target weight and no historical "last time" data exists for that exercise, Active Workout pre-fills the weight ghost value from the target weight instead of showing a blank dash

### Session Continuity

- [x] **SESSION-01**: A persistent floating bar shows "workout in progress" with a live running clock, visible on every screen (Home, Routines, Stats, Settings) while a workout is active
- [x] **SESSION-02**: Tapping the persistent bar navigates directly back into Active Workout at the current exercise
- [x] **SESSION-03**: Leaving Active Workout — via the in-app back button, bottom-nav navigation, or the Android hardware/gesture back — never discards the in-progress session; it keeps running and resumes exactly where left off
- [x] **SESSION-04**: The elapsed-time clock reflects real wall-clock time correctly even after the app is backgrounded and foregrounded again

### Interaction Quality

- [x] **QA-01**: Every interactive control (button, toggle, gesture, drag handle) on every screen is manually exercised and confirmed to perform its stated action
- [x] **QA-02**: Every defect found during the audit is either fixed in this milestone or explicitly logged in PROJECT.md Context with a reason for deferring

### Testing

- [x] **TEST-01**: A test framework (Vitest + Testing Library, per `.planning/codebase/TESTING.md`) is installed and configured
- [x] **TEST-02**: `src/state/reducer.js` has unit test coverage for the actions touched by this milestone (seed removal path, `DELETE_ALL_DATA`, workout start/finish/session transitions)
- [x] **TEST-03**: The new interactive features from this milestone (delete long-press, target-weight field, persistent session bar) have at least smoke-level interaction tests
- [x] **TEST-04**: `npm run lint` and the new test command both run clean as part of "done" for this milestone

## v1.1 Requirements

Requirements for the "Smart Set Flow" milestone — faster on-phone set entry, and
structured rest/superset authoring that matches how the workout actually flows.
Each maps to a v1.1 roadmap phase.

### Fast Set Entry

- [ ] **ENTRY-01**: Active Workout's weight/reps inputs are sized for comfortable one-handed phone entry (larger tap target and font than today's compact row)
- [ ] **ENTRY-02**: Confirming a value in the weight field advances focus to that set's reps field; confirming reps advances focus to the next set's weight field (or blurs, on the last set) — no manual re-tapping between fields
- [ ] **ENTRY-03**: A set is automatically marked done once both its weight and reps hold valid values — the checkmark becomes a manual override/undo, not the only way to complete a set

### Structured Rest Sets

- [ ] **REST-01**: Routine Builder lets the user add and remove explicit rest rows within a block's set sequence, interleaved with sets rather than a single implicit per-block duration
- [ ] **REST-02**: Each rest row's duration is independently editable
- [ ] **REST-03**: A newly added rest row defaults its duration to Settings' "Default rest (sec)" value
- [ ] **REST-04**: Existing routines saved before this milestone (a `sets` count + one `rest` value, no explicit sequence) load and behave exactly as before — backfilled into the new model with no data loss and no behavior change until edited
- [ ] **REST-05**: Active Workout displays rest as an explicit row in the set list (not only the existing bottom sticky timer), reflecting the routine's authored sequence

### Superset Merge & Flow

- [ ] **SUPER-01**: Routine Builder's exercise multi-select can merge 2+ single-exercise blocks into a superset whose sets interleave — exercise A's set, then B's, then A's, then B's — with rest inserted only after each full round (every exercise in the pair has done one set), not after every individual set
- [ ] **SUPER-02**: Active Workout auto-advances to the next exercise in a superset round immediately after a set is marked done — no manual tab-switching required to follow the intended alternating flow
- [ ] **SUPER-03**: Active Workout renders a merged superset as one interleaved flow (both exercises' current position visible together) rather than two independent per-exercise tabs

## v2 Requirements

Deferred to a future release. Tracked but not in this milestone's roadmap.

### Insights & Sharing

- **INSIGHT-01**: On-device or API-generated insight callouts (replacing/augmenting the static Export & Insights summaries)
- **SHARE-01**: Shareable routine/summary image cards
- **SYNC-01**: Cloud sync / multi-device support

## Out of Scope

| Feature | Reason |
|---------|--------|
| On-device/API insights, shareable cards, cloud sync | Original PRD "Phase 3" — deferred until this stabilization milestone ships |
| Social features, coaching marketplace, nutrition tracking, wearable integration | Excluded per original PRD non-goals |
| CI/CD pipeline setup | Not requested; manual `npm run lint` / test run is sufficient for this solo-dev milestone |
| Automated on-device/E2E device-farm testing | Manual testing on the user's own Android device remains the practice; unit/interaction tests cover the rest |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| SAFE-01 | Phase 1 | Complete |
| SAFE-02 | Phase 1 | Complete |
| SESSION-01 | Phase 2 | Complete |
| SESSION-02 | Phase 2 | Complete |
| SESSION-03 | Phase 2 | Complete |
| SESSION-04 | Phase 2 | Complete |
| BUILD-01 | Phase 2 | Complete |
| BUILD-02 | Phase 2 | Complete |
| QA-01 | Phase 3 | Complete |
| QA-02 | Phase 3 | Complete |
| TEST-01 | Phase 4 | Complete |
| TEST-02 | Phase 4 | Complete |
| TEST-03 | Phase 4 | Complete |
| TEST-04 | Phase 4 | Complete |
| ENTRY-01 | Phase 5 | Pending |
| ENTRY-02 | Phase 5 | Pending |
| ENTRY-03 | Phase 5 | Pending |
| REST-01 | Phase 6 | Pending |
| REST-02 | Phase 6 | Pending |
| REST-03 | Phase 6 | Pending |
| REST-04 | Phase 6 | Pending |
| REST-05 | Phase 6 | Pending |
| SUPER-01 | Phase 6 | Pending |
| SUPER-02 | Phase 6 | Pending |
| SUPER-03 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 16 total, all complete
- v1.1 requirements: 11 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-05*
*Last updated: 2026-09-05 — v1 milestone closed (all 16 requirements complete, including Phase 4 TEST-01..04 whose checkboxes were stale); v1.1 "Smart Set Flow" requirements (ENTRY, REST, SUPER) added and mapped to Phases 5-6*
