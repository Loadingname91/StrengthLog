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

- [x] **ENTRY-01**: Active Workout's weight/reps inputs are sized for comfortable one-handed phone entry (larger tap target and font than today's compact row)
- [x] **ENTRY-02**: Confirming a value in the weight field advances focus to that set's reps field; confirming reps advances focus to the next set's weight field (or blurs, on the last set) — no manual re-tapping between fields
- [x] **ENTRY-03**: A set is automatically marked done once both its weight and reps hold valid values — the checkmark becomes a manual override/undo, not the only way to complete a set

### Structured Rest Sets

- [x] **REST-01**: Routine Builder lets the user add and remove explicit rest rows within a block's set sequence, interleaved with sets rather than a single implicit per-block duration
- [x] **REST-02**: Each rest row's duration is independently editable
- [x] **REST-03**: A newly added rest row defaults its duration to Settings' "Default rest (sec)" value
- [x] **REST-04**: Existing routines saved before this milestone (a `sets` count + one `rest` value, no explicit sequence) load and behave exactly as before — backfilled into the new model with no data loss and no behavior change until edited
- [x] **REST-05**: Active Workout displays rest as an explicit row in the set list (not only the existing bottom sticky timer), reflecting the routine's authored sequence

### Superset Merge & Flow

- [x] **SUPER-01**: Routine Builder's exercise multi-select can merge 2+ single-exercise blocks into a superset whose sets interleave — exercise A's set, then B's, then A's, then B's — with rest inserted only after each full round (every exercise in the pair has done one set), not after every individual set
- [x] **SUPER-02**: Active Workout auto-advances to the next exercise in a superset round immediately after a set is marked done — no manual tab-switching required to follow the intended alternating flow
- [x] **SUPER-03**: Active Workout renders a merged superset as one interleaved flow (both exercises' current position visible together) rather than two independent per-exercise tabs

## v1.2 Requirements

Requirements for the "Reliable Alerts" milestone — an Android-native ongoing
workout notification and alerts that fire correctly regardless of which
screen is open or whether the phone is locked. None of this reaches the
GitHub Pages/web build. Each maps to a v1.2 roadmap phase.

### Notification Foundation (Phase 7 — complete, zero native code)

- [x] **NOTIF-01**: Settings shows a "Notifications" card (native builds only) with toggles for rest alerts, the ongoing notification, PR celebrations, and reminders, plus a reminder-time picker and a live permission-status row with a re-request action
- [x] **NOTIF-02**: New settings keys are backfilled to their defaults for existing users generically (defaults merged under persisted values), not via a one-off line per key
- [x] **NOTIF-03**: Notification permission is requested the moment a workout actually starts — from the one lifecycle seam every "start a workout" path funnels through — not at cold app launch
- [x] **NOTIF-04**: A rest-done notification fires via a scheduled local notification even when Active Workout isn't the foreground screen (provisional accuracy; Phase 8 replaces this with a wake-lock-exact version)
- [x] **NOTIF-05**: Workout reminders are computed from the same "next up" schedule Home already surfaces (`dueInfo`/`weekdayName`), not a separate schedule, and reschedule automatically when a session finishes or the schedule changes
- [x] **NOTIF-06**: A new PR posts a standalone notification only when the app is backgrounded — the existing in-app badge already covers the foreground case
- [x] **NOTIF-07**: The notification effect layer depends only on primitives derived from the active workout, never the workout object itself, so a `SET_SET_FIELD` keystroke never reaches the native bridge (proven by a dedicated test: ten keystrokes → zero bridge calls)
- [x] **NOTIF-08**: No scheduled notification triggers Android's exact-alarm permission screen (`isExactNotification: false` on every scheduled call)

### Ongoing Workout Notification (Phase 8 — implemented 2026-09-06, pending on-device verification)

- [ ] **NOTIF-09**: A persistent notification is visible for the whole workout session, showing the routine/exercise name with a live, self-ticking system chronometer (counting up normally, counting down during rest) that needs no per-second traffic from the app — *implemented in `WorkoutService.kt`, unverified: no Android SDK in this environment*
- [ ] **NOTIF-10**: The rest-timer alert (sound + vibration) fires within about a second of its deadline even with the screen locked and the app fully backgrounded, via a foreground service holding a wake lock — not a scheduled OS alarm — *implemented (`PARTIAL_WAKE_LOCK` + `Handler.postDelayed`), unverified on-device*
- [ ] **NOTIF-11**: The ongoing notification exposes working "Skip rest" and "+15s" actions that apply correctly even when the app isn't in the foreground — *implemented (service-side handling + `PendingActionStore` drain into the existing `REST_ADJUST`/`REST_SKIP` actions), unverified on-device*
- [ ] **NOTIF-12**: Finishing, discarding, or deleting all data removes the notification and stops the service within about a second, with no leaked service or notification afterward — *implemented (`ACTION_STOP` teardown path), unverified on-device*
- [ ] **NOTIF-13**: If notification permission is denied, the app never silently starts a service with nothing visible — it falls back to the existing in-app beep and shows an explanatory banner — *implemented (`serviceActive` guard + `SET_NOTIF_FALLBACK` banner), verified via test at the JS layer; the actual system permission-denial path is unverified on-device*

### Notification Polish (Phase 9 — not started)

- [ ] **NOTIF-14**: An action tapped on the notification while the app is fully backgrounded or killed is durably queued and correctly replayed into the reducer on resume, without duplication or reordering
- [ ] **NOTIF-15**: Tapping "Finish" on the notification opens the app into the existing finish-confirmation flow rather than finishing the workout from native code
- [ ] **NOTIF-16**: The rest-done sound ducks any active music playback instead of talking over it, resuming playback afterward
- [ ] **NOTIF-17**: Users on aggressive OEM battery managers see in-app guidance on allowlisting the app so the ongoing notification survives

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
| ENTRY-01 | Phase 5 | Complete |
| ENTRY-02 | Phase 5 | Complete |
| ENTRY-03 | Phase 5 | Complete |
| REST-01 | Phase 6 | Complete |
| REST-02 | Phase 6 | Complete |
| REST-03 | Phase 6 | Complete |
| REST-04 | Phase 6 | Complete |
| REST-05 | Phase 6 | Complete |
| SUPER-01 | Phase 6 | Complete |
| SUPER-02 | Phase 6 | Complete |
| SUPER-03 | Phase 6 | Complete |
| NOTIF-01 | Phase 7 | Complete |
| NOTIF-02 | Phase 7 | Complete |
| NOTIF-03 | Phase 7 | Complete |
| NOTIF-04 | Phase 7 | Complete |
| NOTIF-05 | Phase 7 | Complete |
| NOTIF-06 | Phase 7 | Complete |
| NOTIF-07 | Phase 7 | Complete |
| NOTIF-08 | Phase 7 | Complete |
| NOTIF-09 | Phase 8 | Implemented, pending device verification |
| NOTIF-10 | Phase 8 | Implemented, pending device verification |
| NOTIF-11 | Phase 8 | Implemented, pending device verification |
| NOTIF-12 | Phase 8 | Implemented, pending device verification |
| NOTIF-13 | Phase 8 | Implemented, pending device verification |
| NOTIF-14 | Phase 9 | Not started |
| NOTIF-15 | Phase 9 | Not started |
| NOTIF-16 | Phase 9 | Not started |
| NOTIF-17 | Phase 9 | Not started |

**Coverage:**

- v1 requirements: 16 total, all complete
- v1.1 requirements: 11 total, all complete
- v1.2 requirements: 17 total, 8 complete (Phase 7), 5 implemented pending device verification (Phase 8), 4 not started (Phase 9 — depends on Phase 8's device verification)
- Mapped to phases: 44
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-05*
*Last updated: 2026-09-06 — v1.2 "Reliable Alerts": Phase 7 (Notification Foundation) shipped, all 8 requirements (NOTIF-01..08) complete. Phase 8 (Ongoing Workout Notification, NOTIF-09..13) planned and implemented inline in one session — native foreground service, Capacitor plugin bridge, and JS wiring all written and self-reviewed, 123/123 tests passing — but not counted complete until verified on a real device (no Android SDK in this environment). Phase 9 (NOTIF-14..17) planned and documented but not started.*
