---
phase: 08-ongoing-notification
plan: 1
subsystem: notifications
tags: [android-foreground-service, wake-lock, chronometer, kotlin]
dependency_graph:
  requires:
    - "07-notification-foundation (fitlog_rest_v1 channel, permission plumbing)"
  provides:
    - "android/app/src/main/java/com/fitlog/app/notifications/WorkoutService.kt — the foreground service: chronometer notification, wake-lock-backed rest alarm, Skip/+15s intent handling"
    - "android/app/src/main/java/com/fitlog/app/notifications/PendingActionStore.kt — SharedPreferences-backed durable action queue"
    - "android/app/src/main/java/com/fitlog/app/notifications/NotificationChannels.kt — fitlog_workout_v1 channel"
    - "WorkoutService.actionListener — the extension point 08-02's plugin plugs into"
  affects:
    - android/app/src/main/AndroidManifest.xml
    - android/app/build.gradle
tech_stack:
  added: []
  patterns:
    - "PARTIAL_WAKE_LOCK time-bounded to one rest interval + in-process Handler timer, not AlarmManager — avoids the Android 14 exact-alarm permission screen entirely"
    - "Every onStartCommand call re-posts the notification unconditionally as its first action (except ACTION_STOP) — trivially satisfies the 5-second startForeground deadline on every call path, not just the cold start"
    - "Service exposes a settable callback (actionListener) instead of referencing the plugin class directly — keeps the dependency one-directional so this file compiles and is adb-testable with no plugin/JS code present"
key_files:
  added:
    - android/app/src/main/java/com/fitlog/app/notifications/WorkoutService.kt
    - android/app/src/main/java/com/fitlog/app/notifications/PendingActionStore.kt
    - android/app/src/main/java/com/fitlog/app/notifications/NotificationChannels.kt
  modified:
    - android/app/src/main/AndroidManifest.xml
    - android/app/build.gradle
decisions:
  - "fitlog_rest_v1 is never recreated natively — only referenced by id. It already exists via Phase 7's JS-side ensureChannels(), which always runs before a workout can start. Only the new fitlog_workout_v1 channel is created here."
  - "WorkoutService references nothing from 08-02's plugin. 08-CONTEXT.md's original sketch had the service reach into WorkoutNotificationPlugin.instance directly, which would have made this file fail to compile on its own — inverted to a companion-object actionListener callback the plugin installs from its own load(), so 08-01 stands alone."
  - "START_NOT_STICKY throughout, not START_STICKY — a killed-and-respawned service would get a null Intent with no in-memory state to rebuild a real notification from; the JS effect layer already re-issues a fresh ACTION_START on reinit whenever activeWorkout is still non-null, making a sticky respawn pointless."
  - "The notification's launch PendingIntent targets MainActivity directly (Intent(this, MainActivity::class.java)) rather than packageManager.getLaunchIntentForPackage(packageName) — the latter returns a nullable Intent, which doesn't type-check against PendingIntent.getActivity's non-null parameter in Kotlin."
metrics:
  duration: "~1 session (planning + implementation, no execution split)"
  completed: 2026-09-06
status: complete-unverified-on-device
---

# Phase 8, Plan 1: Native Foreground Service Summary

Implements the native half of NOTIF-09 and NOTIF-10: a self-contained Android foreground service that can be started, updated, and stopped purely via adb-sent intents, with zero dependency on the plugin/JS layer 08-02 builds next.

## What Was Built

1. **`WorkoutService.kt`** — the foreground service. `onStartCommand` posts the notification as its literal first action (before touching SharedPreferences or anything else that could block), satisfying Android's 5-second `startForeground` deadline unconditionally on every call, not just the cold start. The notification uses `setUsesChronometer` + `setChronometerCountDown` + `setWhen`, flipping between counting up (elapsed workout time, base = `startedAt`) and counting down (rest remaining, base = `restUntil`) with zero per-second app traffic — SystemUI drives the tick.

2. **The rest alarm**: a `PARTIAL_WAKE_LOCK` acquired only for the length of the current rest interval (plus a 5s hard-cap safety margin), paired with `Handler.postDelayed`. This is the mechanism that makes the rest-done alert fire accurately even with the screen locked, without ever touching `AlarmManager` or its Android 14 exact-alarm permission screen.

3. **`PendingActionStore.kt`** — a small SharedPreferences-backed JSON queue for Skip/+15s taps, so an action applied while the app's WebView isn't alive to receive it survives until the app resumes and drains it (08-02).

4. **`NotificationChannels.kt`** — creates only the new `fitlog_workout_v1` (LOW, silent) channel; `fitlog_rest_v1` is reused as-is from Phase 7, never recreated.

5. **Manifest + gradle**: `FOREGROUND_SERVICE`/`FOREGROUND_SERVICE_SPECIAL_USE`/`WAKE_LOCK`/`VIBRATE` permissions, the `<service>` block with `foregroundServiceType="specialUse"` and `PROPERTY_SPECIAL_USE_FGS_SUBTYPE="workout_rest_timer"`, and an explicit `androidx.core:core` dependency (previously only transitive via `appcompat`).

## A Real Bug Caught Before Writing Any Code

Self-reviewing the plan against 08-CONTEXT.md's own sketch (goal-backward, the same check a plan-checker pass would do) surfaced a real design flaw: the original design had `WorkoutService` reach into `WorkoutNotificationPlugin.instance` directly to emit its fast-path event — but that class doesn't exist until 08-02, meaning this plan's own file wouldn't have compiled in isolation, directly contradicting its own "independently adb-testable" goal. Fixed by inverting the coupling: `WorkoutService` exposes a settable `actionListener` callback; 08-02's plugin plugs into it. The dependency now points from the newer file to the older one, never backward.

## Verification

`npm test` (115/115 → still 115/115, untouched), `npm run lint` (identical warning set), `npm run build` all confirmed green before and after this plan's diff, since it's native-only. The four Kotlin/manifest/gradle files were reviewed by hand against 08-CONTEXT.md's decisions (D-01 through D-06) and against the actual `androidx.core`/`compileSdk` versions in `android/variables.gradle` — **not compiled**, since this session's environment has no Android SDK (confirmed: no `java`/`adb` on `PATH`; a Windows-side SDK exists at `/mnt/c/Android` this WSL session cannot invoke). The adb verification recipe for this plan's own slice (start → foreground check → update → lock-and-wait for the rest alert → stop → leak check) is recorded in `08-01-PLAN.md` Task 4 for the user's on-device pass.

## What's Deliberately Not Here

No plugin, no JS change, no Skip/+15s round-trip to the reducer (the service applies these to its own state and queues them, but nothing drains that queue yet) — that's 08-02, which plugs into `actionListener` and swaps `nativeNotifications.js`'s stubs for real calls into this service.
