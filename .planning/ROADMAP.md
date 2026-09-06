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
- [x] **Phase 6: Structured Sets — Rest Rows & Superset Merge** - Rest becomes an explicit, editable row in a block's set sequence; merging exercises into a superset makes Active Workout auto-alternate between them with rest clustered around each full round (completed 2026-09-05)

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
- [x] 06-01-PLAN.md — Data model (`sequence` field + backfill) and Routine Builder authoring UI (REST-01..04, SUPER-01)
- [x] 06-02-PLAN.md — Active Workout runtime: rest rows in the set list, superset auto-advance and merged rendering (REST-05, SUPER-02, SUPER-03)
**UI hint**: yes — `06-UI-SPEC.md` written and signed off (sequence editor design, merged-superset card, rest-row states)

## Progress (v1.1 — Smart Set Flow)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Fast Set Entry | 1/1 | Complete    | 2026-09-05 |
| 6. Structured Sets — Rest Rows & Superset Merge | 2/2 | Complete    | 2026-09-05 |

**v1.1 "Smart Set Flow" shipped 2026-09-05** — all 11 requirements complete (ENTRY-01..03, REST-01..05, SUPER-01..03).

---

# Roadmap: v1.2 — Reliable Alerts

## Overview

Today's rest-timer alert (`beep()` + `navigator.vibrate` in `ActiveWorkout.jsx`) only fires while the `/workout` screen is mounted, driven by a 1Hz `setInterval`. Navigate to Home, lock the phone, or switch apps mid-rest and the countdown keeps running in state but nothing ever alerts the user — for an app whose core value is "never lose track mid-session," an alert that depends on which screen happens to be open is the largest remaining gap. This milestone closes it with a persistent, Spotify-style ongoing notification for the whole workout session, plus alerts (rest done, reminders, PR celebrations) that fire correctly even with the phone locked.

**Platform scope**: this is Android-native work. None of it reaches the GitHub Pages build — the web/prototype experience is unchanged throughout (the in-app beep still works there), and every native call is gated behind `Capacitor.isNativePlatform()`. Verification past Phase 7 requires a real device build (`npx cap sync android` + `gradlew.bat installDebug`), which this environment cannot compile (no Android SDK, Java/Gradle only).

**Architecture, decided up front** (full detail in `07-CONTEXT.md`):
- Two mechanisms, not four bespoke ones: rest-done + the ongoing notification need sub-second accuracy and process survival, so they get a **custom foreground service**; reminders + PR celebrations are fire-and-forget, so they use **`@capacitor/local-notifications`** as-is.
- The rest timer avoids `AlarmManager`'s exact-alarm permission entirely — since Android 14 that requires a user-facing system-settings toggle. Instead, the foreground service holds a **time-bounded `PARTIAL_WAKE_LOCK`** for one rest interval and runs an in-process timer: accurate to the second, zero extra permission, negligible battery, because it only ever runs while a workout (and therefore the service) is already active.
- The ongoing notification's live countdown costs **zero bridge traffic**: `setUsesChronometer` + `setChronometerCountDown` + `setWhen(restUntil)` is a self-ticking display driven entirely by Android's SystemUI, which keeps counting on the lock screen even if the app process is dead.
- Explicitly **not** `MediaSession`/`MediaStyle`, despite that being Spotify's literal mechanism — it would hijack Bluetooth earbud play/pause, demote the user's actual music in the lock-screen carousel, and (the decisive reason) `MediaStyle` is a custom template that **cannot use the chronometer**, trading away the one feature that makes the notification self-updating.

## Phases

- [x] **Phase 7: Notification Foundation** - The full JS effect layer (idempotent against keystrokes), settings + permission UX, and every trigger that needs zero native code — reminders, PR celebrations, and a provisional rest-done alert (completed 2026-09-06)
- [ ] **Phase 8: Ongoing Workout Notification** - A custom Android foreground service: persistent Spotify-style notification with a live chronometer, wake-lock-accurate rest alerts, and working Skip/+15s actions (implemented 2026-09-06, pending on-device verification before it counts as done)
- [ ] **Phase 9: Notification Polish** - Durable action replay across process death, a native "Finish" deep-link into the existing confirm flow, audio ducking so the rest ding cuts through music, and battery-optimization guidance

## Phase Details

### Phase 7: Notification Foundation

**Goal**: Every notification trigger that can be built without native code is real and working, on a JS effect layer proven immune to the one failure mode that would make it unusable — reaching the native bridge on every keystroke.
**Mode:** mvp
**Depends on**: Nothing (first phase of this milestone)
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08
**Success Criteria** (what must be TRUE):

  1. Settings shows a "Notifications" card (native builds only) with toggles for rest alerts, the ongoing notification, PR celebrations, and reminders, plus a reminder-time picker and live permission status with a re-request button.
  2. An existing user's persisted settings gain every new notification key at its default value on next load — none read as `undefined` — without a per-key backfill line.
  3. Notification permission is requested the moment a workout actually starts (any entry point — Home's card or Routine Overview's), not at cold app launch.
  4. A rest-done notification fires via a scheduled local notification even when Active Workout isn't the foreground screen — strictly better than today's screen-dependent beep, though not yet wake-lock-exact (that's Phase 8).
  5. Workout reminders derive from the same "next up" schedule Home already surfaces (`dueInfo`/`weekdayName` — no separate scheduling logic), and reschedule automatically whenever a session finishes or the schedule changes.
  6. A new PR posts a standalone notification only when the app is backgrounded — the existing in-app badge already covers the foreground case, so this never duplicates it.
  7. Ten consecutive `SET_SET_FIELD` dispatches (a user typing into a weight field) produce zero calls into the native notification bridge — proven by a dedicated test, not just code review.
  8. No scheduled notification ever triggers Android's exact-alarm permission screen (`isExactNotification: false` everywhere) — confirmed against the plugin's own type definitions, not assumed.

**Plans**: Implemented directly against `07-CONTEXT.md`'s design rather than through separate task-level PLAN.md files — see `07-SUMMARY.md` for what shipped and why.

**UI hint**: yes — a Notifications card in Settings, described in `07-CONTEXT.md`

### Phase 8: Ongoing Workout Notification

**Goal**: The rest alert and the persistent session notification are backed by a real Android foreground service, closing the gap Phase 7's scheduled notification deliberately left open (OS-alarm drift under battery optimization).
**Mode:** mvp
**Depends on**: Phase 7 (the JS effect layer, settings, and permission plumbing this phase's native service plugs into)
**Requirements**: NOTIF-09, NOTIF-10, NOTIF-11, NOTIF-12, NOTIF-13
**Success Criteria** (what must be TRUE):

  1. Starting a workout shows a persistent notification with the routine/exercise name and a live, self-ticking chronometer (counting up normally, counting down during rest) that requires no per-second traffic from the app.
  2. With the phone locked and the app fully backgrounded, the rest-done alert (sound + vibration) fires within about a second of the deadline — verified after forcing device idle, not just under normal conditions.
  3. The notification exposes working "Skip rest" and "+15s" actions that apply correctly even when tapped with the app not in the foreground.
  4. Finishing, discarding, or deleting all data removes the notification and stops the service within about a second, with no leaked service or notification left behind afterward.
  5. If notification permission is denied, the service never starts silently with nothing visible — the app falls back to the existing in-app beep and shows a banner explaining why.

**Plans**: 2/2 plans complete (implemented inline, no subagent dispatch — see `08-01-SUMMARY.md`/`08-02-SUMMARY.md`); on-device verification (the steps that decide whether this phase's success criteria are actually met) not yet run — no Android SDK in this environment.
Plans:

- [x] 08-01-PLAN.md — Native foreground service in isolation: WorkoutService, PendingActionStore, NotificationChannels, manifest + gradle (NOTIF-09, NOTIF-10)
- [x] 08-02-PLAN.md — Capacitor plugin bridge + JS wiring: pending-action drain, permission-denied fallback banner (NOTIF-11, NOTIF-12, NOTIF-13)

**UI hint**: no new screens — the "UI" is the Android notification itself, specified in `08-CONTEXT.md`

### Phase 9: Notification Polish

**Goal**: The rough edges deliberately deferred out of Phase 8 — action durability across a killed process, a proper native path to finishing a workout, and real-world usability (music ducking, battery-manager guidance) — are closed.
**Mode:** mvp
**Depends on**: Phase 8 (polishes the foreground service's action-handling and lifecycle)
**Requirements**: NOTIF-14, NOTIF-15, NOTIF-16, NOTIF-17
**Success Criteria** (what must be TRUE):

  1. An action tapped on the notification while the app is fully backgrounded or killed is still applied correctly once the app resumes — queued durably, replayed in order, never duplicated.
  2. Tapping "Finish" on the notification opens the app straight into the existing finish-confirmation flow rather than finishing the workout from native code (which doesn't have the logic to build a session).
  3. The rest-done sound ducks any active music playback (e.g. Spotify) instead of talking over it, and playback resumes automatically afterward.
  4. Settings (or an in-app prompt) tells a user on an aggressive OEM battery manager (Xiaomi/Samsung/OnePlus-class) how to allowlist the app, rather than the ongoing notification silently dying with no explanation.

**Plans**: Not yet started — see `09-CONTEXT.md`.

**UI hint**: minor — one guidance banner/row, no new screens

## Progress (v1.2 — Reliable Alerts)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Notification Foundation | Implemented directly | Complete | 2026-09-06 |
| 8. Ongoing Workout Notification | 2/2 | Implemented, pending device verification | 2026-09-06 |
| 9. Notification Polish | 0 | Not started | — |

**Phase 7 of v1.2 shipped 2026-09-06** — 8 of 17 requirements complete (NOTIF-01..08). **Phase 8 implemented 2026-09-06** — NOTIF-09..13 built and self-reviewed (native foreground service + plugin bridge + JS wiring), 123/123 tests passing, but not yet counted complete: this environment has no Android SDK, so the on-device steps that decide whether the phase actually works (foreground notification, wake-lock-exact rest alert, Skip/+15s surviving a killed process, clean teardown, permission-denied fallback) are the user's next step on a real device. Phase 9 (NOTIF-14..17) is planned and documented but not started, and depends on Phase 8's device verification landing first.
