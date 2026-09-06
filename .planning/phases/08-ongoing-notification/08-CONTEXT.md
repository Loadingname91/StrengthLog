# Phase 8: Ongoing Workout Notification - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning/execution — requires a real Android SDK + device, which this session's environment does not have

<domain>
## Phase Boundary

This phase builds the custom Android foreground service that Phase 7
deliberately left out: a persistent, Spotify-style notification for the
whole workout session with a live system-driven chronometer, and
wake-lock-accurate rest-done alerts that fire on time even with the screen
locked and the app backgrounded. It replaces Phase 7's provisional
scheduled-notification rest alert (`src/lib/nativeNotifications.js`'s
`updateWorkout()`), which is a real but inexact stopgap.

Maps to requirements NOTIF-09 through NOTIF-13.

**Cannot be executed in a container without an Android SDK.** This phase's
own environment had Java 21 and Gradle but no `ANDROID_HOME` — Java/Kotlin
cannot be compiled or tested here. `npx cap sync android` (file copying +
gradle regeneration only) is the extent of what's verifiable without a real
toolchain. Pick this up on a machine with the Android SDK and, ideally, a
physical device or emulator for the on-device verification steps below.
</domain>

<decisions>
## Implementation Decisions

### The core insight that makes this work
- **D-01:** A foreground service does **not** keep the CPU awake —
  `Handler.postDelayed` runs on `SystemClock.uptimeMillis()`, which stalls
  during Doze. Exact `AlarmManager` alarms need `SCHEDULE_EXACT_ALARM`,
  which since Android 14 requires the user to flip a system-settings
  toggle — exactly the jarring flow Phase 7 already found and avoided for
  `@capacitor/local-notifications`. The answer: since rest only ever runs
  for 60-180s **while a workout is active** (i.e. exactly when this service
  is running), the service can hold a **`PARTIAL_WAKE_LOCK` time-bounded to
  one rest interval** and use an in-process timer. Accurate to the second,
  zero extra permission, negligible battery (a couple minutes of wake-lock
  per set, not per workout).

### Foreground service type — `specialUse`, not `health`
- **D-02:** Use `specialUse`, not `health`. `health` requires
  `FOREGROUND_SERVICE_HEALTH` *plus* one of `BODY_SENSORS` /
  `HIGH_SAMPLING_RATE_SENSORS` / `ACTIVITY_RECOGNITION` — a second runtime
  prompt (or a declared sensor permission the app never uses) for an app
  that reads no sensors, and `BODY_SENSORS` is deprecated as of API 36.
  Not `shortService` (~3 min hard cap — a workout is an hour) or `dataSync`
  (6h cap on API 35+, background-start restricted). Manifest:

  ```xml
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
  <uses-permission android:name="android.permission.WAKE_LOCK" />
  <uses-permission android:name="android.permission.VIBRATE" />
  <!-- POST_NOTIFICATIONS already arrives via @capacitor/local-notifications' own manifest -->

  <service
      android:name=".notifications.WorkoutService"
      android:exported="false"
      android:foregroundServiceType="specialUse"
      android:stopWithTask="false">
    <property
        android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
        android:value="workout_rest_timer" />
  </service>
  ```

  Start it via `ServiceCompat.startForeground(this, NOTIF_ID, notification,
  ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)` — handles the API-29/34
  branching so no hand-written `Build.VERSION.SDK_INT` checks are needed.

### The 5-second rule
- **D-03:** `startForegroundService()` gives 5 seconds to call
  `startForeground()` or the process is killed
  (`ForegroundServiceDidNotStartInTimeException`). `onStartCommand` must
  build and post the notification as its literal first action, before
  parsing intent extras or touching SharedPreferences.

### Live countdown, zero bridge traffic
- **D-04:** `setUsesChronometer(true)` + `setChronometerCountDown(true)` +
  `setWhen(millis)` renders a self-ticking `mm:ss` driven entirely by
  SystemUI — no per-second app traffic, keeps ticking on the lock screen
  even if the process is dead. `setChronometerCountDown` is API 24+,
  exactly this project's `minSdk` — no version guard needed. One
  chronometer slot switches meaning: resting → `setWhen(restUntil)`,
  counting down; otherwise → `setWhen(startedAt)`, counting up as elapsed
  workout time. Total notification traffic: about two re-posts per set
  (rest start, rest end), plus one per Skip/+15s tap.

### POST_NOTIFICATIONS denied is the nastiest failure mode
- **D-05:** On Android 13+, a foreground service still runs even if its
  notification can't be shown — meaning a denied permission makes the
  workout *silently* appear to work with nothing visible, forever. Never
  start the service when denied: fall back to the existing in-app beep
  (`ActiveWorkout.jsx`, already native-guarded from Phase 7) and show an
  inline banner explaining rest alerts only work while that screen is open.
  Phase 7 already requests the permission at workout start; this phase adds
  the fallback path for when it's denied.

### Channels — immutable after first creation
- **D-06:** Two more channels beyond Phase 7's three, created once via
  `NotificationChannelCompat` (no-ops below API 26, no `SDK_INT` guard
  needed for `minSdk` 24): `fitlog_workout_v1` (LOW importance, silent — the
  ongoing notification) is new; `fitlog_rest_v1` (HIGH, heads-up,
  `VISIBILITY_PUBLIC`) already exists from Phase 7 and gets reused here for
  the exact rest-done alert. Channel settings (importance/sound/vibration)
  can never change from code after first creation — a wrong choice means
  shipping a `_v2` id and deleting the old one, not patching it.

### JS↔native bridge
- **D-07:** A new custom plugin, `WorkoutNotificationPlugin`
  (`start`/`update`/`stop`/`getPending`/`ack`/`openNotificationSettings`),
  replacing Phase 7's no-op stubs inside `src/lib/nativeNotifications.js`
  for `startWorkout`/`updateWorkout`/`stopWorkout` specifically (reminders
  and PR celebrations stay on `@capacitor/local-notifications` — unchanged
  from Phase 7). The existing `useWorkoutNotifications.js` effect layer
  needs **no changes** — it already calls exactly this surface; only the
  implementation behind `nativeNotifications.js`'s three lifecycle/content
  functions changes.
- **Action round-trip when backgrounded/dead:** the service applies a
  Skip/+15s tap to its own state immediately, appends
  `{id, workoutId, type, payload, at}` to a SharedPreferences-backed queue,
  and emits a Capacitor event (fast path if the WebView is alive). On
  resume, JS drains the queue and dispatches the **existing** `REST_ADJUST`
  / `REST_SKIP` reducer actions (no new reducer case), then acks. Safe
  because queued items are relative deltas applied in order — no absolute
  timestamp crosses the bridge into the reducer. Drop any action whose
  `workoutId` doesn't match the current workout.
- **Finish must not happen natively** — `FINISH_WORKOUT` builds the session,
  computes volume/PR counts, and advances `sequenceIndex`; the service
  knows none of that. A "Finish" tap is a `PendingIntent` that launches
  `MainActivity`, surfaced to JS, which routes to the existing
  `ConfirmSheet` flow (this specific wiring is Phase 9's `NOTIF-15`, not
  required for Phase 8's own success criteria).

### Notification content
- Standard `NotificationCompat` template, **not** `MediaStyle` (see the
  project-wide non-goal below). `setSmallIcon` reuses Phase 7's
  `ic_stat_workout`. Two actions while resting (Skip rest, +15s), one
  otherwise (a placeholder "Finish" that just opens the app until Phase 9
  wires the deep link). `setOngoing(true)`, `setOnlyAlertOnce(true)`,
  `setSilent(true)` (the ongoing notification itself is silent — the
  separate rest-done alert on `fitlog_rest_v1` is what makes sound).

### Non-goal, decided and worth restating here
- **No MediaSession/MediaStyle**, despite it being Spotify's literal
  mechanism. It would hijack Bluetooth earbud play/pause (routes to the most
  recently active `MediaSession`), demote the user's actual music in the
  lock-screen carousel, require declaring a false `mediaPlayback` service
  type, and — decisively — **`MediaStyle` is a custom template that cannot
  use the chronometer**, which would trade away the one thing that makes
  this notification update itself without the app running.
</decisions>

<files>
## Files to Create/Modify

**New native** (`android/app/src/main/java/com/fitlog/app/notifications/`):
`WorkoutNotificationPlugin`, `WorkoutService`, `NotificationChannels`,
`PendingActionStore`. **Language call:** Capacitor's own official plugins
(including `@capacitor/local-notifications`, checked directly in
`node_modules`) are written in **Kotlin**, not Java — worth defaulting to
Kotlin here too for the same reasons (less boilerplate, no manual
`SDK_INT`-guard ceremony, the modern idiom), even though `MainActivity.java`
stays plain Java — the two interop without friction.

**New resources:** none beyond what Phase 7 already added
(`ic_stat_workout.xml`); the new `fitlog_workout_v1` channel is created via
code (`NotificationChannelCompat`), not a resource file.

**Modified native:** `MainActivity.java` (`registerPlugin(WorkoutNotificationPlugin.class)`
before `super.onCreate`), `AndroidManifest.xml` (the permissions + `<service>`
block above), `android/app/build.gradle` (make `androidx.core:core`
explicit — it currently arrives only transitively through `appcompat`).

**Modified JS:** only `src/lib/nativeNotifications.js` (swap the three
lifecycle stubs for real plugin calls) — `useWorkoutNotifications.js`,
`reminderPlan.js`, and every screen are untouched, since Phase 7 already
built the full call surface this phase implements against.

**Regenerated by `cap sync`:** nothing new — no additional npm package for
this phase (the plugin is local/custom, registered via `registerPlugin` in
`MainActivity`, not via `capacitor.settings.gradle`).
</files>

<verification>
## Verification Strategy

**In a container without the SDK:** nothing beyond what Phase 7 already
covers — the JS side doesn't change. `npm test`/`lint`/`build` should stay
green throughout since this phase's diff is native-only.

**On device (the steps that decide whether this phase is actually done):**
1. Start Workout → permission prompt (if not already granted) → ongoing
   notification appears, chronometer counting **up**.
2. `adb shell dumpsys activity services com.fitlog.app` → `isForeground=true`,
   type includes `specialUse`.
3. Tick a set with rest → chronometer flips to counting **down**; actions
   become Skip / +15s.
4. **Lock the phone, wait out the rest → sound + vibration fire on time
   (±1s).** This is the core requirement the whole phase exists for.
5. Repeat step 4 after `adb shell dumpsys deviceidle force-idle` — proves
   the wake lock is doing the work, not luck.
6. Lock screen → tap +15s → countdown jumps; unlock and confirm the in-app
   timer agrees (the event fast-path, or the drain-on-resume path if the
   WebView was dead).
7. Swipe the app from Recents mid-workout → notification survives
   (`stopWithTask="false"`), rest still fires.
8. **Finish / discard / delete-all-data → notification gone within ~1s**;
   `adb shell dumpsys notification --noredact | findstr fitlog` and
   `dumpsys activity services com.fitlog.app` both empty. Leak check.
9. Deny notifications in system settings → start a workout → in-app banner
   appears, no crash, in-app beep still works.
</verification>

<risks>
## Risks, In Likely-First Order

1. **FGS type/permission mismatch** → a `SecurityException` crash on the
   first "Start Workout" if the manifest's permission/property pairing
   isn't exact. Get D-02's snippet verbatim.
2. **The 5-second `startForeground` deadline** (D-03) — do nothing before
   posting the notification.
3. **POST_NOTIFICATIONS denied → invisible service** (D-05) — handle
   explicitly, this is the one most likely to look like "the feature is
   broken" to the user rather than an obvious crash.
4. **OEM battery managers** (Xiaomi/Samsung/OnePlus) can still kill a
   foreground service outright. The wake-lock approach survives Doze but
   not a determined OEM killer — mitigated by documentation (Phase 9,
   NOTIF-17: tell the user to set the app to Unrestricted), not code.
5. **Channel immutability** — get the rest channel's importance/visibility
   right the first time; a wrong choice needs a new versioned channel id to
   fix, not a patch.
</risks>
