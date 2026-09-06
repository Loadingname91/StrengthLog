# Phase 7: Notification Foundation - Context

**Gathered:** 2026-09-06
**Status:** Implemented (written retrospectively — see `07-SUMMARY.md` for what shipped)

<domain>
## Phase Boundary

This phase builds everything a workout-notification system needs that does
NOT require native Android code: the JS effect layer that watches
`activeWorkout` and turns it into native calls, the settings + permission
UX, and the two triggers (reminders, PR celebrations) plus a provisional
third (rest-done) that `@capacitor/local-notifications` can deliver on its
own. It does NOT build the ongoing Spotify-style notification or
wake-lock-exact rest timing — those need a custom foreground service
(Phase 8) that this session's environment (no Android SDK) cannot compile
or verify.

Maps to requirements NOTIF-01 through NOTIF-08.

**Trigger:** the user asked directly for "Spotify-style" background
notifications and a lock-screen mini-player for the rest timer. Investigation
found the existing alert (`beep()` + `navigator.vibrate` in
`ActiveWorkout.jsx`) only fires while `/workout` is the mounted screen — a
real, previously-unflagged gap against the project's core value statement
("never lose track mid-session").
</domain>

<decisions>
## Implementation Decisions

### Two mechanisms, not four bespoke ones
- **D-01:** Rest-done and the ongoing notification need sub-second accuracy
  and process survival → a custom foreground service (Phase 8). Reminders
  and PR celebrations are fire-and-forget → `@capacitor/local-notifications`
  as installed, no native code. This phase only touches the second bucket,
  plus a *provisional* rest-done notification via the same plugin (accepted
  drift under battery optimization, strictly better than today's
  screen-dependent beep).

### Why not exact alarms
- **D-02:** A foreground service does not keep the CPU awake — timers based
  on `SystemClock.uptimeMillis()` stall in Doze. But `AlarmManager`'s exact
  mode needs `SCHEDULE_EXACT_ALARM`, a user-facing system-settings toggle
  since Android 14. Phase 8's answer is a **time-bounded wake lock held only
  for one rest interval** — accurate, permission-free, since it only ever
  runs while a workout (and the service) is already active. This phase's
  provisional rest alert uses a plain scheduled notification instead and
  explicitly accepts its inexactness as a known, temporary limitation.

### `isExactNotification: false` — a real finding, not an assumption
- **D-03:** `@capacitor/local-notifications`' `schedule()` defaults every
  notification to `isExactNotification: true`. Per the plugin's own type
  definitions: on API 31+, if the app isn't yet allowed to schedule exact
  alarms, **the system "Alarms & reminders" settings screen is opened**
  automatically the first time it's needed — regardless of
  `isExactMandatory`. That is precisely the jarring, permission-gated flow
  this whole design exists to avoid for a lightweight rest-timer ping.
  Every scheduled call in `src/lib/nativeNotifications.js` explicitly sets
  `isExactNotification: false`. Verified by reading
  `node_modules/@capacitor/local-notifications/dist/*.d.ts` directly rather
  than trusting an earlier design summary that hadn't checked this.

### The effect layer: primitives, not the object
- **D-04:** `src/state/useWorkoutNotifications.js`, mounted in
  `StoreContext.jsx` right after the existing `saveState` effect — the same
  architectural slot, since this is a side effect layered on the reducer,
  not baked into it (matches the project's stated persistence pattern).
  Four watchers:
  - **A — lifecycle**, deps `[awId]`. `FINISH_WORKOUT`, `DISCARD_WORKOUT`,
    and `DELETE_ALL_DATA` all set `activeWorkout: null` wholesale, so that
    one transition is the only "stop everything" seam needed. A non-null id
    on mount (persisted across a cold restart) starts it too. Notification
    permission is requested here too — the one seam every "start a workout"
    path (Home's card, Routine Overview's) funnels through, rather than
    duplicating the request at each button.
  - **B — content**, deps `[awId, restUntil, restTotal, setsDone, setsTotal,
    exerciseName]` → `updateWorkout()`.
  - **C — PR**, deps include `awId` plus the PR's coordinates. `lastPR` is
    **never cleared** for the life of a workout (`reducer.js`'s
    `TOGGLE_SET_DONE` carries it forward via `: aw.lastPR`), so the
    fired-key ref is **seeded from the current value on mount**, or a cold
    reload mid-workout would re-celebrate whatever PR was already sitting in
    persisted state.
  - **D — reminders**, deps on settings + schedule fields, calling the new
    pure `buildReminderPlan(state, now)`.
  - **Why this is safe against keystrokes:** every dependency above is a
    **primitive** derived from `activeWorkout`, not the object itself. A
    `SET_SET_FIELD` dispatch (typing into a weight field) replaces
    `activeWorkout` with a brand-new object every time but touches none of
    these primitives, so React skips the effect entirely — proven by a
    dedicated test asserting ten keystrokes produce zero `updateWorkout`
    calls, the single most important test in this phase.

### Reminders reuse the existing schedule, don't invent a new one
- **D-05:** `src/lib/reminderPlan.js`'s `buildReminderPlan` tracks the exact
  same "next up" routine `Home.jsx` already surfaces
  (`routineOrder[sequenceIndex]`), using the existing `dueInfo()` and
  `weekdayName()` from `src/lib/schedule.js` — not an independent
  per-routine weekly schedule. `dueInfo` returns a calendar day with no
  time-of-day (hence the `reminderTime` setting) and its due date shifts
  whenever a session is logged, so the plan is **re-derived on every
  relevant state change**, not scheduled once. A fixed singleton id
  (`REMINDER_ID`) means a reschedule always replaces the same notification
  rather than leaking duplicates.

### PR notifications don't duplicate the in-app badge
- **D-06:** `ActiveWorkout.jsx` already shows an in-app PR badge for ~2.6s.
  A shade notification for something the user is already looking at is
  noise, so `notifyPR()` checks `document.visibilityState !== 'visible'`
  before posting.

### Settings backfill, fixed generically
- **D-07:** There was no settings backfill at all before this phase — any
  new key would read as `undefined` for existing users forever.
  `buildInitialState()` now does
  `persisted.settings = { ...initialSettings(), ...persisted.settings }`,
  fixing this for every future settings key, not just the five this phase
  adds (`notifyRestDone`, `notifyOngoing`, `notifyPR`, `notifyReminders`,
  `reminderTime`).

### Notification icon and color, needed even without native code
- **D-08:** Android renders a notification's small icon as a plain
  alpha-channel silhouette — the app's actual launcher icon (a full-color
  PNG) would render as a white blob. Added
  `android/app/src/main/res/drawable/ic_stat_workout.xml` (a simple
  alpha-only barbell) and `capacitor.config.json`'s
  `plugins.LocalNotifications.{smallIcon,iconColor}` config, using the
  app's own light-mode accent (`#C1633A`, from `src/index.css`). **Never**
  create `android/app/src/main/res/values/colors.xml` with the names
  `colorPrimary`/`colorPrimaryDark`/`colorAccent` — verified that
  `styles.xml` references all three, currently resolved from Capacitor's
  own library resources; reusing those names in the app module would
  silently retheme the entire app.

### Three real rest-timer bugs, found while building the data layer
- **D-09:** `REST_ADJUST` was unclamped — repeated "-15s" taps could push
  `restUntil` into the past (which would arm a negative timer natively).
  Now clamped to `>= Date.now()`, and `restTotalSec` moves with it (it
  previously didn't, letting the progress ring's ratio exceed 1).
- **D-10:** The ding-played guard was a plain boolean, so a "+15s" tap after
  the ding had already fired could never ding again for the new deadline.
  Now keyed on the deadline value itself (`dingPlayedFor` ref).
- **D-11:** `RestRow`'s "is this rest active" check compared
  `aw.restTotalSec === restSeconds` — a *duration* match, so two sets
  sharing the same rest length both lit up as active simultaneously. Fixed
  by adding a `restSetIndex` field alongside the existing
  `restExerciseIndex` and comparing both against the row's actual position.
</decisions>

<constraints>
## Technical Constraints

- **No native code in this phase.** Every native call goes through
  `Capacitor.isNativePlatform()` guards; the web/Pages build is provably
  unaffected (verified with a real-browser Playwright run: create routine →
  start workout → log/finish a set → visit Settings, zero console errors).
- **This container has no Android SDK** — Java 21 and Gradle exist, but
  `npx cap sync android` (which only copies files and regenerates two
  tracked gradle files) is the extent of what's verifiable here. Compiling
  the native side is out of reach until Phase 8.
- **Channels are immutable after first creation** (importance, sound,
  vibration can never change from code again) — hence versioned channel ids
  (`fitlog_rest_v1`, `fitlog_reminders_v1`, `fitlog_pr_v1`) created via the
  plugin's own `createChannel()` JS API, no native code needed.
</constraints>

<references>
## Existing Patterns to Follow

- `src/state/StoreContext.jsx`'s `saveState` effect — the precedent for "a
  side effect layered on top of the reducer," which `useWorkoutNotifications`
  follows exactly.
- `src/lib/schedule.js`'s `dueInfo()`/`weekdayName()` — reused, not
  reimplemented, by `reminderPlan.js`.
- `src/screens/ActiveWorkout.jsx`'s existing PR badge — the reason PR
  notifications only post when backgrounded.
- `src/screens/Settings.jsx`'s `Row` + checkbox pattern (e.g. "Show RIR
  chips") — reused for every new Notifications card toggle.
</references>
