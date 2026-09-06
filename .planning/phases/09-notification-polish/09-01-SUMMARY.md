---
phase: 09-notification-polish
plan: 1
subsystem: notifications
tags: [android-audio-focus, vibrator, mediaplayer, kotlin]
dependency_graph:
  requires:
    - "08-01/08-02 (WorkoutService, PendingActionStore, the pending-action pipeline)"
  provides:
    - "WorkoutService.playDuckedDing()/vibrateForRestDone()/abandonDuckingFocus() — audio-focus-aware rest-done alert (NOTIF-16)"
    - "WorkoutService.handleFinishTapped()/ACTION_FINISH_TAPPED — native half of the notification's Finish action (NOTIF-15)"
    - "PendingActionStore.MAX_QUEUE_SIZE — bounded durable queue (NOTIF-14 hardening)"
  affects: []
key_files:
  modified:
    - android/app/src/main/java/com/fitlog/app/notifications/WorkoutService.kt
    - android/app/src/main/java/com/fitlog/app/notifications/PendingActionStore.kt
tech_stack:
  added: []
  patterns:
    - "AudioManager.requestAudioFocus(AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) + MediaPlayer(USAGE_ALARM) instead of channel-default notification sound — the mechanism that actually ducks concurrent music rather than just playing over it"
    - "The Finish notification action targets the service (enqueue + startActivity), not the activity directly — reuses Phase 8's pending-action pipeline instead of inventing a second delivery path"
    - "API 24/25 fallback via one-line deprecated calls, isolated in small dedicated methods — the one place in this codebase where a hard SDK_INT branch is unavoidable (no AndroidX compat shim for audio focus below API 26)"
key_decisions:
  - "postRestDoneAlert()'s builder-level setVibrate/setSound (Phase 8's pre-O fallback) removed, replaced with setSilent(true) — keeping both would either play the ding twice (channel sound + new MediaPlayer ding) or leave dead code once setSilent suppresses the old ones uniformly across API levels."
  - "VibrationEffect.createWaveform() moved inside the API-26+ branch, not hoisted above it — caught during self-review: it's a real method call (not just a type reference), so calling it unconditionally would crash with NoClassDefFoundError on API 24-25 before the branch could route around it."
  - "The Finish action's pending action carries no payload — 09-02 doesn't need one, just the type string, same as REST_SKIP."
metrics:
  duration: "~1 session (planning + implementation, no execution split)"
  completed: 2026-09-06
status: complete-unverified-on-device
---

# Phase 9, Plan 1: Native Audio Ducking + Finish Deep-Link Foundation Summary

Implements NOTIF-16 in full (native-only, no JS needed) and the native half of NOTIF-15, plus a defensive bound on Phase 8's pending-action queue (NOTIF-14 hardening).

## What Was Built

1. **Ducked rest-done alert.** `postRestDoneAlert()`'s notification is now `setSilent(true)` — purely visual. `playDuckedDing()` requests `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` (API 26+ via `AudioFocusRequest`, a one-line deprecated fallback below it) and plays the system notification sound through a `MediaPlayer` tagged `USAGE_ALARM`/`CONTENT_TYPE_SONIFICATION`, releasing the player and abandoning focus on completion or failure. `vibrateForRestDone()` calls `Vibrator`/`VibratorManager` directly with `VibrationEffect.createWaveform` + `AudioAttributes.USAGE_ALARM`, independent of the channel's own vibration setting.

2. **Finish action routes through the service.** The notification's "Finish" button now targets `WorkoutService` via `ACTION_FINISH_TAPPED` instead of opening the activity directly. `handleFinishTapped()` enqueues a `FINISH_TAPPED` pending action through the exact same `enqueueAndEmit` Skip/+15s already use, then calls `startActivity()` to bring the app forward — no new plugin method, no new native-to-JS surface.

3. **Bounded pending-action queue.** `PendingActionStore` now caps at 50 entries, dropping the oldest first — a workout nobody ever reopens can no longer grow the SharedPreferences-backed queue without limit.

## A Real Bug Caught During Self-Review

While writing `vibrateForRestDone()`, `VibrationEffect.createWaveform(...)` was first hoisted above the `if (Build.VERSION.SDK_INT >= O)` branch (mirroring how the field-level `audioFocusRequest: AudioFocusRequest?` declaration is safely unconditional). But unlike a field/type reference, `createWaveform` is an actual static method call — calling it unconditionally would resolve (and crash with `NoClassDefFoundError`) on API 24-25 devices *before* the version check could route around it. Fixed by moving the call inside the branch, matching how every other API-26+ call in this file is already scoped.

## Verification

`npm test` (123/123, unchanged), `npm run lint` (identical warning set), `npm run build` (clean) — all confirmed before and after, since this plan's diff is native-only. Reviewed by hand against Android's documented `AudioManager`/`MediaPlayer`/`Vibrator` APIs; **not compiled** — same environment constraint as every native change this milestone (no Android SDK, confirmed no `java`/`adb` on `PATH`).

## What's Deliberately Not Here

The JS side: nothing drains or acts on `FINISH_TAPPED` yet (09-02 adds the reducer flag, the `ActiveWorkout.jsx`/`App.jsx` routing, and the resume-triggered drain that closes NOTIF-14's "backgrounded but not killed" gap). Battery-manager guidance (NOTIF-17) is pure JS/UI, also 09-02.
