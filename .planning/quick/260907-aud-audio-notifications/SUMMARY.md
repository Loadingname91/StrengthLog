---
quick_id: 260907-aud
slug: audio-notifications
date: 2026-09-07
status: complete
---

# Summary: Audio for reminders, PR, and rest-done notifications

## Root cause

Two related gaps, both tracing to the same underlying dependency:

1. `fitlog_reminders_v1`/`fitlog_pr_v1` (`src/lib/nativeNotifications.js`) never passed a `sound`
   field to `LocalNotifications.createChannel()`. Read the plugin's own Android source
   (`node_modules/@capacitor/local-notifications/.../NotificationChannelManager.kt`) to confirm:
   `setSound()` is only called when the field is present — otherwise Android's own
   `NotificationChannel` constructor default applies, which is just a pointer to the phone's
   system-wide default notification sound. `vibration` wasn't passed either, so
   `enableVibration(false)` was called explicitly.
2. The already-shipped rest-done ding (`WorkoutService.kt`'s `playDuckedDing()`, Phase 9) has the
   exact same dependency one layer down — it played `RingtoneManager.getDefaultUri(TYPE_NOTIFICATION)`,
   the same system default. Its audio-focus ducking (`AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`) was and
   is correct; it just had nothing audible to duck *to* if that system default is silent.

## What shipped

**1. `android/app/src/main/res/raw/fitlog_chime.wav`** — new bundled asset. A synthesized two-note
ascending chime (660Hz → 880Hz, 0.28s, 16-bit mono PCM @ 44100Hz), generated locally via Python's
`wave`/`struct`/`math` stdlib — no internet fetch, no third-party sample. Same register as the
existing in-app WebAudio beep (`ActiveWorkout.jsx`, 880Hz) for a consistent sound identity.

**2. `src/lib/nativeNotifications.js`** — `ensureChannels()`:
- `fitlog_reminders_v1` → `fitlog_reminders_v2`, now with `sound: 'fitlog_chime', vibration: true`
- `fitlog_pr_v1` → `fitlog_pr_v2`, same
- `fitlog_rest_v1` left untouched — its notification is always posted with `setSilent(true)`
  (`WorkoutService.kt`), so the channel's own sound is never actually used

Version bump is required, not optional: channels are immutable after first creation, so a device
that already created `_v1` silently can never be fixed by changing the same channel id.
`notifyPR()` and `applyReminderPlan()`'s `channelId` references updated to match.

**3. `android/app/src/main/java/com/fitlog/app/notifications/WorkoutService.kt`** —
`playDuckedDing()` now plays the bundled `R.raw.fitlog_chime` resource via a
`android.resource://` Uri instead of `RingtoneManager.getDefaultUri()`. Used the typed `R.raw.*`
accessor (compile-time checked) rather than a raw filename string, a small robustness improvement
over the plan's literal suggestion. Everything else — the `AudioFocusRequest`, ducking, cleanup —
is unchanged. Removed the now-unused `RingtoneManager` import.

## Explicitly out of scope

- The ongoing workout notification stays silent — deliberate, by design (updates every set).
- No Settings.jsx change — sound rides along with each notification type's existing toggle, per
  the user's choice.
- The main checkout's uncommitted, unfinished multi-reminder rework (`state.reminders`, a
  `/reminders` route not yet wired into the reducer/router) — untouched, and not a dependency of
  this work; `nativeNotifications.js`'s channel plumbing is identical either way.

## Verification

- `npm test` — 133 passed / 15 files (unchanged from baseline; no test asserted the old channel
  id strings, since `useWorkoutNotifications.test.jsx` mocks the whole `nativeNotifications`
  module rather than testing its internals)
- `npm run lint` — identical warning set to before, no new issues
- `npm run build` — clean
- `npx cap sync android` — clean (one generated-file artifact, `android/capacitor.settings.gradle`,
  reverted — its relative `node_modules` path was recalculated for this worktree's nested
  directory depth and would have broken once merged back into the main checkout)

Not verified: on-device audibility, by construction — this is a native-boundary change with no
Android SDK in this environment, same constraint as every notification phase this milestone. The
whole premise of this fix (system-default-sound dependency) is itself only confirmable on a real
device with the system default actually set to silent.
