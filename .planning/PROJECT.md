# FitLog (StrengthLog)

## What This Is

A mobile-first, fully offline workout tracker for Android (React + Vite + Capacitor), matching the core mechanics of reference apps like StrengthLog — routine-based sessions, PR tracking, muscle-group heatmaps, and statistics — with CSV import/export and a warmer visual design the reference apps lack. Built for one user's own daily training log.

## Core Value

Logging a workout mid-session — weight, reps, RIR, rest — must be fast, reliable, and never lose data, even if the user backgrounds the app or navigates away mid-session.

## Requirements

### Validated

- ✓ Routine-based workout logging: create/edit routines, superset grouping, drag-to-reorder — existing
- ✓ Active workout session: per-set weight/reps/RIR entry, ghost placeholders from last session, auto rest timer, PR detection — existing
- ✓ Home dashboard, Stats hub (Overview/Muscles/Log/Measurements tabs), Measurements tracking — existing
- ✓ CSV Import and Export & Insights screens — existing
- ✓ Settings: units, theme, default rest, RIR display toggle, data management — existing
- ✓ Android packaging via Capacitor, with hardware/gesture back-button handling — existing (fixed this session)
- ✓ Seeded demo data removed (`src/lib/seed.js` deleted) — fresh installs start completely empty — Phase 1
- ✓ "Delete all data" requires a 1.5s press-and-hold with visible fill progress; early release cancels silently — Phase 1
- ✓ Optional target-weight field on Routine Builder exercise blocks, feeding the Active Workout ghost/placeholder value when no history exists — Phase 2
- ✓ Persistent global "workout in progress" session bar with a live elapsed-time clock, visible across Home/Routines/Stats/Settings, tappable to resume — Phase 2
- ✓ Back-navigation out of Active Workout resumes reliably via the session bar, bottom-nav Log button, and Android hardware back — Phase 2/3
- ✓ Systematic interaction audit across every screen, 6 defects fixed (menu dismissal, workout-resume-not-overwrite, missing delete confirmations) — Phase 3
- ✓ Vitest + Testing Library test suite: reducer/buildInitialState unit tests, smoke tests for the hold gesture/target-weight field/session bar — Phase 4
- ✓ Test coverage extended to `src/lib/schedule.js`, `src/lib/csvImport.js`, `src/lib/selectors.js` (all previously untested/fragile per `CONCERNS.md`) — post-milestone fix
- ✓ `RoutineBuilder.jsx` drag-to-reorder gesture now aborts on `visibilitychange`/`blur` (app backgrounded mid-drag), closing the one finding Phase 3 deliberately deferred — post-milestone fix
- ✓ React error boundary added around the route tree — a crash in one screen no longer white-screens the whole app; BottomNav/SessionBar/back-button handling stay alive and a "Try again" resets to Home — post-milestone fix
- ✓ Corrupted `localStorage` blob is now backed up (not silently destroyed) before the app falls back to a fresh empty state — closes the direct conflict between the old silent-discard behavior and this project's stated "never lose data" core value; no recovery UI yet (see `CONCERNS.md`) — post-milestone fix
- ✓ Active Workout's weight/reps inputs enlarged to a touch-friendly size, with a confirm-to-advance focus chain (Weight → Reps → next set's Weight) and auto-mark-done once both fields are valid — the checkmark stays a manual override — Phase 5
- ✓ Routine Builder's block editor replaces the flat "Sets" count with an explicit, editable sequence of set/round and rest rows — rest is addable/removable/individually editable, defaulting new rows from Settings' "Default rest (sec)" — Phase 6
- ✓ Merging exercises into a superset produces a sequence that alternates rounds with rest only after each full round; Active Workout renders a merged superset as one interleaved flow (both exercises' current round together) and auto-advances between them using the same focus chain Phase 5 built — Phase 6
- ✓ Custom exercises (created in-app, not in the static catalog) now resolve correctly everywhere — muscle heatmap, insights, goal progress, CSV export, and every screen that shows an exercise name — instead of being silently skipped or shown as a raw internal id — post-milestone fix
- ✓ Home/Stats overview chart redesigned with axis gridlines, value labels, an area fill, and point markers, replacing a bare unlabeled polyline — post-milestone fix
- ✓ Insight surfaces rebuilt around delta numbers and comparisons instead of sparse line charts: a fixed-range sets-per-muscle band (not scaled to the user's own busiest muscle), a "this week vs. 4-week average" card, a GitHub-style consistency calendar, and a recent-PRs list — post-milestone feature
- ✓ Static GitHub Pages deployment of the web build for layout/prototype testing on a phone browser, with SPA routing fixed via a `BrowserRouter` `basename` (`import.meta.env.BASE_URL`) so the app isn't limited to native-device testing during iteration — post-milestone infra
- ✓ Notification effect layer, settings, permission UX, and every trigger buildable without native code (reminders, PR celebrations, a provisional rest-done alert) — Phase 7 (v1.2)

### Active

v1.0 stabilization milestone: none — all requirements validated and shipped.

v1.1 "Smart Set Flow" milestone: none — all requirements validated and shipped.

v1.2 "Reliable Alerts" milestone: Phase 8 (Ongoing Workout Notification — the custom Android foreground service) is implemented (`08-01-PLAN.md`/`08-02-PLAN.md`, `08-01-SUMMARY.md`/`08-02-SUMMARY.md`) but not yet verified — this session has no Android SDK, so the on-device steps that decide whether NOTIF-09..13 actually work remain the user's next step on a real device. Phase 9 (Notification Polish) is designed (`.planning/phases/09-notification-polish/09-CONTEXT.md`) but not started, and depends on Phase 8's device verification landing first.

### Out of Scope

- On-device/API-generated insights, shareable routine/summary cards, cloud sync/multi-device — original PRD's "Phase 3," deferred until this stabilization milestone ships
- Social features, coaching marketplace, nutrition tracking, wearable integration — excluded per original PRD non-goals

## Context

- **v1.2 "Reliable Alerts" opened and Phase 7 shipped 2026-09-06.** Prompted
  directly by the user asking for Spotify-style background notifications and
  a lock-screen mini-player for the workout timer. Investigation found the
  existing rest-timer alert only fires while `/workout` is the mounted
  screen — a real gap given the core value statement. Architecture (full
  detail in `07-CONTEXT.md`): two mechanisms, not four bespoke ones — a
  custom Android foreground service for anything needing sub-second accuracy
  or process survival (the ongoing notification, the rest ding), and
  `@capacitor/local-notifications` as-is for anything fire-and-forget
  (reminders, PR celebrations). The foreground service avoids
  `AlarmManager`'s exact-alarm permission (a user-facing system toggle since
  Android 14) entirely by holding a **time-bounded wake lock for one rest
  interval** instead — accurate, permission-free, since it only ever runs
  while a workout (and the service) is already active. The live countdown
  on the ongoing notification costs zero bridge traffic via Android's own
  `setUsesChronometer`/`setChronometerCountDown`. Explicitly not
  `MediaSession`/`MediaStyle` despite that being Spotify's literal mechanism
  — decisive reason: `MediaStyle` is a custom template that cannot use the
  chronometer, which would trade away the one feature that makes the
  notification self-updating without the app running. Sequenced so
  everything testable landed before any native code: Phase 7 (this session)
  is pure JS + the local-notifications plugin, fully verified by 115 passing
  tests and a real-browser check with zero native code written; Phase 8 (the
  actual foreground service) and Phase 9 (polish) are designed but require a
  native build environment — Java/SDK + device — this session doesn't have,
  so they're picked up separately. One real finding worth flagging:
  `@capacitor/local-notifications` defaults every scheduled notification to
  requesting an *exact* alarm, which on API 31+ opens the system "Alarms &
  reminders" settings screen the first time it's needed — exactly the
  permission flow this design was built to avoid. Caught by reading the
  plugin's actual type definitions rather than assuming; every scheduled
  call here explicitly sets `isExactNotification: false`. Three real
  rest-timer bugs were also found and fixed while building the data layer
  the notifications depend on: `REST_ADJUST` was unclamped (repeated "-15s"
  could push the deadline into the past), the ding-played guard couldn't
  fire twice for a new deadline, and two sets sharing a rest duration could
  both show as "active" simultaneously.
- **v1.1 "Smart Set Flow" milestone shipped 2026-09-05**, same day it was opened.
  Three related asks from real use: (1) weight/reps entry needed bigger inputs
  and fewer taps on a phone; (2) rest needed to be an explicit, editable part
  of a routine's set sequence rather than one implicit per-block number; (3)
  supersets needed to actually alternate exercises automatically in Active
  Workout, with rest clustered around each full round rather than each
  individual set. Full trail: discussion (`05-DISCUSSION-LOG.md`,
  `06-DISCUSSION-LOG.md`) → context → UI-SPEC (`06-UI-SPEC.md`, checker-passed)
  → task-level plans → execution (`05-01-SUMMARY.md`, `06-01-SUMMARY.md`,
  `06-02-SUMMARY.md`). One notable plan-time refinement: `06-CONTEXT.md`
  originally sketched a nested step-type model with its own navigation
  pointer for tracking position within a merged superset; writing the actual
  reducer surfaced a simpler design (a flat `restAfter` array + `exerciseIndex`
  tag alongside the existing `sets` array) that needed zero new navigation
  state, since Phase 5's confirm-to-advance focus chain already crosses
  between exercises correctly once the underlying array is round-ordered.
  All 11 requirements (ENTRY-01..03, REST-01..05, SUPER-01..03) complete and
  verified — reducer/component tests plus real-browser Playwright checks for
  both phases, including a full single-exercise + superset workout logged
  end-to-end and confirmed in session history.
- Full product vision lives in `docs/app.md` (PRD) — screens, interaction rules, and the phased MVP cut this project already mostly implements
- Fresh codebase map lives in `.planning/codebase/` (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS) — `TESTING.md` confirms zero test framework currently exists; `CONCERNS.md` has the fuller technical-debt list
- App is fully offline/local-only: state persists to `localStorage` (`src/state/storage.js`), no backend, no auth, no external APIs
- This session already fixed two live bugs pre-dating this plan: the Settings "Delete all data" confirmation sheet not closing, and Android back-gesture exiting the app instead of navigating — both committed already
- User is testing on a real Android device via `npx cap sync android` + `gradlew.bat installDebug` from `android/`, on Windows/WSL
- Phase 3 interaction audit (QA-01/QA-02) deferred one finding rather than fixing it at the time: `RoutineBuilder.jsx`'s drag-to-reorder gesture had no `visibilitychange`/`blur` safeguard against an interrupted drag. **This was fixed post-milestone**: the same `abortDrag` pattern used by `ConfirmSheet`'s hold-to-confirm (CR-01) was added, with a passing smoke test (`RoutineBuilder.test.jsx`) confirming a `blur` event during an active drag clears `dragId`/`dragY`.
- Post-milestone, `CONCERNS.md`'s test-coverage gap for `src/lib/schedule.js`, `src/lib/csvImport.js`, and `src/lib/selectors.js` was closed with unit tests (`schedule.test.js`, `csvImport.test.js`, `selectors.test.js`) covering the date-rollover arithmetic, CSV row validation/unit conversion, and PR/volume calculations respectively — this was flagged as fragile-with-zero-coverage but was out of Phase 4's TEST-01..04 scope (which targeted only this milestone's own new features), so addressing it was a deliberate scope extension, not part of the original roadmap.
- Post-milestone, a React error boundary (`src/components/ErrorBoundary.jsx`) was added around the route tree in `App.jsx`, addressing `CONCERNS.md`'s "No error boundary / crash reporting" gap. It resets on every route change (`key={pathname}`) and offers a "Try again" that navigates Home. No crash-reporting service is wired up (this is a fully offline, local-only app) — errors are only logged to the console.
- Still open from `CONCERNS.md`, not addressed (deliberately, as larger architectural changes rather than fixes — see that file for full detail): `reducer.js`/large-screen-component splitting, Prettier adoption, data-corruption recovery on a malformed `localStorage` blob, debounced saves, and any migration off `localStorage`'s size ceiling (e.g. to IndexedDB). None of these are regressions or bugs — they're pre-existing scaling/maintainability considerations for a future milestone.

## Constraints

- **Tech stack**: React 19, Vite, Tailwind v4, react-router v7, Capacitor 8 (Android only) — stay within this stack, no new frameworks
- **Data**: fully local via `localStorage`, offline-first — no backend/sync work in this milestone
- **Platform**: Android via Capacitor; native build runs from `android/` on Windows (`gradlew.bat`), web assets rebuilt via `npm run build && npx cap sync android` before each native install
- **Testing**: Vitest + Testing Library, installed and in active use since Phase 4 (v1.0) — 115 tests across 14 files as of Phase 7 (v1.2)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Long-press hold for "Delete all data" instead of a second confirm tap | User fat-fingered the existing single-tap confirm; a hold gesture with visual progress is much harder to trigger by accident | Shipped — Phase 1 |
| Global persistent workout session bar instead of only an in-screen timer | User expects to see a running session anywhere in the app, not just on the Active Workout screen, and wants live elapsed time visible at a glance | Shipped — Phase 2 |
| Add a test suite this milestone rather than deferring it | User explicitly linked "no unit tests" to the quirks being found; safety net is a stated goal, not a nice-to-have | Shipped — Phase 4 |
| Fix the Phase 3 deferred drag-gesture finding post-milestone rather than leaving it deferred indefinitely | Same interrupted-gesture bug class already fixed once for the delete hold (CR-01); the fix is small, isolated, and now has direct test coverage — no reason to leave a known-fixable gap open once flagged | Shipped — post-milestone |
| Extend test coverage to `schedule.js`/`csvImport.js`/`selectors.js` beyond Phase 4's required scope | `CONCERNS.md` called these the most fragile, highest-risk, zero-coverage files in the codebase; Phase 4 only mandated tests for this milestone's new features, leaving pre-existing fragile logic still unprotected | Shipped — post-milestone |
| Add a React error boundary rather than a crash-reporting service | App is fully offline/local-only with no backend — a third-party crash-reporting SDK would be a new dependency for a single-user app; a boundary that keeps navigation alive and logs to console is proportionate to the actual risk | Shipped — post-milestone |
| Back up (not fully recover) a corrupted localStorage blob | The silent-discard-then-overwrite behavior directly conflicted with the stated core value; a full recovery UI would need reordering StoreProvider/ToastProvider (StoreProvider is outer, runs before React mounts) — out of proportion for what's fundamentally a rare edge case; preserving the raw blob is the minimal fix that stops permanent data loss | Shipped — post-milestone |
| Rest as an explicit, individually-editable row in a block's sequence, not a per-block toggle | User's explicit choice between the two options presented — matches "add a rest set" and "option to select them" read literally | Shipped — Phase 6 |
| Merged supersets auto-advance with one interleaved view, not manual tab-switching | User's explicit choice, confirmed as "the bigger, more involved change" before proceeding | Shipped — Phase 6 |
| Fast set entry does both auto-advance-focus and auto-mark-done, not one or the other | User selected "both" over either alone | Shipped — Phase 5 |
| Superset runtime uses a flat `restAfter`/`exerciseIndex` design instead of the originally-sketched nested step-type model | Surfaced while writing the actual reducer code — a much smaller diff, and it means Phase 5's focus-chain already handles cross-exercise auto-advance with no new navigation state needed | Shipped — Phase 6 |
| A custom Android foreground service (not `@capacitor/local-notifications` alone) for the ongoing notification and rest alert | Needs sub-second accuracy with the screen off and process survival across backgrounding; the plugin alone has no chronometer and no foreground-service protection | Shipped (pending device verification) — Phase 8 |
| A time-bounded wake lock + in-process timer instead of `AlarmManager`'s exact alarms | Exact alarms need `SCHEDULE_EXACT_ALARM`, a user-facing system-settings toggle since Android 14; the wake lock needs no extra permission and only ever runs while the service (i.e. a workout) is already active | Shipped (pending device verification) — Phase 8 |
| No MediaSession/MediaStyle despite that being Spotify's literal mechanism | Would hijack Bluetooth earbud play/pause, demote the user's own music in the lock-screen carousel, and — decisively — `MediaStyle` is a custom template that can't use the chronometer, trading away the one thing that makes the notification self-updating | Decided — Phase 8 design, not applicable to build (non-goal) |
| `isExactNotification: false` on every `@capacitor/local-notifications` call | The plugin defaults to requesting an exact alarm, which opens a system settings screen on first use — the exact permission flow this design exists to avoid; found by reading the plugin's type definitions, not assumed | Shipped — Phase 7 |
| Phase 7 (JS layer + local-notifications) executed directly against `07-CONTEXT.md` rather than through separate task-level PLAN.md files | The design was already fully specified and reviewed before implementation; splitting it into formal plan documents would have added ceremony without changing what got built | Shipped — Phase 7 |
| Phase 8 planned through formal PLAN.md files (unlike Phase 7's direct execution), executed inline with no subagent dispatch | User's explicit standing direction against GSD subagent spawning, plus an explicit ask this session to go through the full discuss→plan→execute flow rather than skip straight to code | Shipped (pending device verification) — Phase 8 |
| `WorkoutService` exposes a settable `actionListener` callback rather than referencing `WorkoutNotificationPlugin` directly | 08-CONTEXT.md's original sketch had the service reach into the plugin class, which doesn't exist until the second plan — would have broken the first plan's own "compiles and is adb-testable standalone" goal; caught during a goal-backward plan self-review before any code was written | Shipped (pending device verification) — Phase 8 |
| `restUntil` crosses the JS↔native bridge as epoch milliseconds, converted in `nativeNotifications.js`, not the reducer's ISO string | Keeps all date parsing on the JS side — the Kotlin side never needs `java.time`, which would require Java 8+ desugoring this project doesn't have configured for a minSdk-24 target | Shipped (pending device verification) — Phase 8 |
| A `serviceActive` flag in `nativeNotifications.js` guards `updateWorkout`/`stopWorkout` from calling the native bridge at all when the service was never started | Without it, `Context.startService()`'s "start if not running" behavior would silently bring the foreground service up as a side effect of an unrelated content update — exactly the failure NOTIF-13 (permission-denied fallback) exists to prevent | Shipped — Phase 8 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-06 — v1.2 "Reliable Alerts" opened, Phase 7 (Notification Foundation) shipped.*
