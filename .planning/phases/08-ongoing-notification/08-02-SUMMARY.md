---
phase: 08-ongoing-notification
plan: 2
subsystem: notifications
tags: [capacitor-plugin, kotlin, foreground-service-bridge, pending-action-drain]
dependency_graph:
  requires:
    - "08-01 (WorkoutService, PendingActionStore, NotificationChannels, the actionListener extension point)"
  provides:
    - "android/app/src/main/java/com/fitlog/app/notifications/WorkoutNotificationPlugin.kt — the @CapacitorPlugin bridge"
    - "src/lib/nativeNotifications.js — real startWorkout/updateWorkout/stopWorkout + drainPendingActions/onWorkoutAction/ackAction"
    - "useWorkoutNotifications.js effect E — pending-action drain, dispatching the existing REST_ADJUST/REST_SKIP actions"
    - "reducer.js SET_NOTIF_FALLBACK — workout-scoped permission-denied flag"
    - "ActiveWorkout.jsx fallback banner"
  affects:
    - android/app/src/main/java/com/fitlog/app/MainActivity.java
    - src/state/StoreContext.jsx
key_files:
  added:
    - android/app/src/main/java/com/fitlog/app/notifications/WorkoutNotificationPlugin.kt
  modified:
    - android/app/src/main/java/com/fitlog/app/MainActivity.java
    - src/lib/nativeNotifications.js
    - src/state/useWorkoutNotifications.js
    - src/state/useWorkoutNotifications.test.jsx
    - src/state/reducer.js
    - src/state/reducer.test.js
    - src/state/StoreContext.jsx
    - src/screens/ActiveWorkout.jsx
    - src/screens/ActiveWorkout.test.jsx
tech_stack:
  added: []
  patterns:
    - "restUntil crosses the JS<->native bridge as epoch milliseconds (converted in nativeNotifications.js), not the ISO string the reducer stores — keeps all date parsing on the JS side, no java.time/desugaring needed natively"
    - "serviceActive module flag in nativeNotifications.js guards updateWorkout/stopWorkout from ever (re)starting the service as a side effect of Context.startService() on a service that was deliberately never started"
    - "A ref (stateRef) synced in its own no-deps effect, read (never written) inside stable effect closures — the standard escape hatch from exhaustive-deps for values an effect needs fresh without wanting to re-run on their change"
decisions:
  - "startWorkout() became async and now performs the permission request itself (replacing a separate requestNotificationPermission() call effect A used to make right after it) — it already needs the result to decide whether to start the service, so the second call was redundant, not additive."
  - "A notifyOngoing:false return is false (no banner), not true — Settings' own copy already explains that turning the ongoing notification off also turns off rest alerts; that's a deliberate, already-explained choice, not the permission-denied failure state NOTIF-13 targets."
  - "The fallback flag lives on activeWorkout.notifFallback (workout-scoped, cleared implicitly when activeWorkout resets to null) rather than a separate top-level UI-only state slice — mirrors lastPR's existing pattern exactly, no new architectural concept."
  - "Test mocks for startWorkout/drainPendingActions must resolve/await, not return undefined/run synchronously — effect A calls .then() unconditionally now, and effect E's real drain function awaits before ever calling apply(); a synchronous test mock would call the render-hook's own view.rerender before the view handle exists. Caught by running the suite, not assumed."
metrics:
  duration: "~1 session (planning + implementation, no execution split)"
  completed: 2026-09-06
status: complete-unverified-on-device
---

# Phase 8, Plan 2: Plugin Bridge + JS Wiring Summary

Implements NOTIF-11, NOTIF-12, and NOTIF-13 — the Capacitor plugin bridge to 08-01's service, the pending-action drain that closes the Skip/+15s round-trip across a killed process, and the permission-denied fallback banner. This is where 08-01's service actually gets used by the app.

## What Was Built

1. **`WorkoutNotificationPlugin.kt`** — a thin `@CapacitorPlugin` forwarding `start`/`update`/`stop`/`getPending`/`ack`/`openNotificationSettings` to `WorkoutService` via `Intent`s, plus `load()` wiring its `emitAction` into 08-01's `WorkoutService.actionListener` extension point (the only coupling between the two files, pointing the safe direction). `MainActivity.java` registers it via an instance initializer block, before `super.onCreate` runs.

2. **`nativeNotifications.js`'s three lifecycle stubs became real.** `startWorkout()` is now `async`: it skips entirely when `notifyOngoing` is off, otherwise requests permission and either starts the real service or returns `true` so the caller can show a fallback banner. A `serviceActive` module flag guards `updateWorkout`/`stopWorkout` from ever calling into a service that was deliberately never started — without it, `Context.startService()`'s "start if not running" behavior would silently bring the foreground service up as a side effect of an unrelated content update, exactly what NOTIF-13 exists to prevent.

3. **The pending-action drain (`useWorkoutNotifications.js` effect E)**: drains `WorkoutService`'s durable queue once on mount (covering a killed-and-restarted process) and subscribes to the live `workoutAction` event (the fast path, while the WebView is already running). Both funnel through one guarded `apply()` that drops any action whose `workoutId` doesn't match the currently active workout, then dispatches the *existing* `REST_ADJUST`/`REST_SKIP` reducer actions — no new reducer case for the round-trip itself.

4. **`SET_NOTIF_FALLBACK`** (reducer.js) — a workout-scoped flag, structurally identical to the existing `lastPR` pattern, driving a small banner in `ActiveWorkout.jsx`: "Notifications are blocked, so rest alerts only work while this screen stays open."

## Refinements Found While Writing the Actual Code

- `restUntil` crosses the bridge as epoch milliseconds (`nativeNotifications.js` converts it), not the reducer's ISO string — keeps all date parsing on the JS side; the Kotlin side never needs `java.time` (which would require Java 8+ desugoring this project doesn't have configured).
- A `stateRef`, synced in its own no-op-array `useEffect`, replaced a first-draft render-time `ref.current = state` assignment (`react(refs): Cannot access refs during render` — a real lint warning, not a style nit) and let effect A read `startedAt`/`notifyOngoing` without adding them to its dependency array, which would have made the effect re-fire on every mid-workout setting change it's deliberately meant to ignore.
- Existing test mocks needed real async shapes, not bare `vi.fn()`: `startWorkout` now must resolve a boolean (effect A calls `.then()` unconditionally), and a `drainPendingActions` mock that calls `apply()` synchronously would reach into the render-hook test harness's `view.rerender` before `view` exists — the fix mirrors the real function's actual shape (an `await` before any `apply()` call).

## Verification

`npm test`: 115 → **123/123** passing (4 new in `useWorkoutNotifications.test.jsx` — fallback dispatch, drain-on-mount wiring, workoutId-match/drop, live-event ack; 2 new in `reducer.test.js` for `SET_NOTIF_FALLBACK`; 2 new in `ActiveWorkout.test.jsx` for the banner). `npm run lint`: identical warning set to the pre-phase baseline (the two warnings this plan's first draft introduced were fixed, not tolerated). `npm run build` and `npx cap sync android` both clean. The Kotlin plugin file was checked by hand against the actual Capacitor Android source in `node_modules/@capacitor/android` (`PluginCall`/`Plugin`/`JSObject` method signatures — `getLong`, `getData()`, `notifyListeners`, `CapacitorPlugin`'s real package) rather than assumed from memory, but **not compiled** — same environment constraint as 08-01.

## What's Deliberately Not Here

Everything Phase 9 owns: durable replay ordering guarantees beyond "applied once, in order" (NOTIF-14's stronger contract), the native "Finish" deep-link into the real confirm flow (today's Finish action just opens the app), audio ducking, and battery-optimization guidance. The on-device verification steps this plan's own success criteria depend on (permission-denied banner appearing on a real device, Skip/+15s surviving a killed process for real, the full leak check) are recorded in `08-02-PLAN.md`'s `<verification>` section for the user's Windows/device session.
