# Requirements: FitLog (StrengthLog)

**Defined:** 2026-09-05
**Core Value:** Logging a workout mid-session must be fast, reliable, and never lose data.

## v1 Requirements

Requirements for this stabilization milestone. Each maps to a roadmap phase.

### Data

- [ ] **DATA-01**: App launches with zero seeded/demo data — no fake routines, no fake session history — on a fresh install (empty `localStorage`)
- [ ] **DATA-02**: Removing seed data does not affect any user who already has saved data — the seed path only ever ran when `localStorage` was empty

### Safety

- [ ] **SAFE-01**: "Delete all data" requires a press-and-hold gesture with a visible hold-progress indicator, not a single tap, before the destructive action fires
- [ ] **SAFE-02**: Releasing the hold before it completes cancels the action — no data loss, no partial delete

### Routine Builder

- [ ] **BUILD-01**: Routine Builder's exercise block editor has an optional target-weight field alongside sets/reps/rest/RIR
- [ ] **BUILD-02**: When a block has a target weight and no historical "last time" data exists for that exercise, Active Workout pre-fills the weight ghost value from the target weight instead of showing a blank dash

### Session Continuity

- [ ] **SESSION-01**: A persistent floating bar shows "workout in progress" with a live running clock, visible on every screen (Home, Routines, Stats, Settings) while a workout is active
- [ ] **SESSION-02**: Tapping the persistent bar navigates directly back into Active Workout at the current exercise
- [ ] **SESSION-03**: Leaving Active Workout — via the in-app back button, bottom-nav navigation, or the Android hardware/gesture back — never discards the in-progress session; it keeps running and resumes exactly where left off
- [ ] **SESSION-04**: The elapsed-time clock reflects real wall-clock time correctly even after the app is backgrounded and foregrounded again

### Interaction Quality

- [ ] **QA-01**: Every interactive control (button, toggle, gesture, drag handle) on every screen is manually exercised and confirmed to perform its stated action
- [ ] **QA-02**: Every defect found during the audit is either fixed in this milestone or explicitly logged in PROJECT.md Context with a reason for deferring

### Testing

- [ ] **TEST-01**: A test framework (Vitest + Testing Library, per `.planning/codebase/TESTING.md`) is installed and configured
- [ ] **TEST-02**: `src/state/reducer.js` has unit test coverage for the actions touched by this milestone (seed removal path, `DELETE_ALL_DATA`, workout start/finish/session transitions)
- [ ] **TEST-03**: The new interactive features from this milestone (delete long-press, target-weight field, persistent session bar) have at least smoke-level interaction tests
- [ ] **TEST-04**: `npm run lint` and the new test command both run clean as part of "done" for this milestone

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
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| SAFE-01 | Phase 1 | Pending |
| SAFE-02 | Phase 1 | Pending |
| SESSION-01 | Phase 2 | Pending |
| SESSION-02 | Phase 2 | Pending |
| SESSION-03 | Phase 2 | Pending |
| SESSION-04 | Phase 2 | Pending |
| BUILD-01 | Phase 2 | Pending |
| BUILD-02 | Phase 2 | Pending |
| QA-01 | Phase 3 | Pending |
| QA-02 | Phase 3 | Pending |
| TEST-01 | Phase 4 | Pending |
| TEST-02 | Phase 4 | Pending |
| TEST-03 | Phase 4 | Pending |
| TEST-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-05*
*Last updated: 2026-09-05 after roadmap creation (phase count finalized at 4: BUILD-01/02 folded into Phase 2 with Session Continuity as one core-value slice; QA and Testing renumbered to Phase 3 and Phase 4)*
