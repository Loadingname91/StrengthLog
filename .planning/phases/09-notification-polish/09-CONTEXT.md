# Phase 9: Notification Polish - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning — depends on Phase 8 shipping first

<domain>
## Phase Boundary

The rough edges deliberately left out of Phase 8 to keep it landable on its
own: durable action replay across a fully killed process, a proper native
path to finishing a workout, audio ducking so the rest ding doesn't talk
over music, and guidance for users on aggressive OEM battery managers.
None of this blocks Phase 8's own success criteria — it's what makes the
feature robust under real-world conditions rather than just working in the
happy path.

Maps to requirements NOTIF-14 through NOTIF-17.
</domain>

<decisions>
## Implementation Decisions

### Pending-action durability
- **D-01:** Phase 8's `PendingActionStore` (SharedPreferences-backed queue)
  already exists structurally; this phase is what actually exercises the
  "app was fully killed, not just backgrounded" path end-to-end — draining
  the queue on cold start (not just on `appStateChange` resume), bounding
  the queue size, and confirming replay order matches what the notification
  showed. This is the fiddliest logic in the whole notification system and
  was deliberately deferred out of Phase 8 rather than risked alongside a
  first-ever foreground service.

### Native "Finish" deep-link
- **D-02:** `FINISH_WORKOUT` builds the session (volume, PR counts,
  `sequenceIndex` advance) — logic the service cannot and should not
  duplicate natively. A "Finish" tap on the notification becomes a
  `PendingIntent` launching `MainActivity` with an extra the plugin reads in
  `handleOnNewIntent`, surfaced to JS via `getPending()`, which routes to
  `/workout` and opens the app's **existing** `ConfirmSheet` — no new
  confirmation UI, just triggering the one that's already there.

### Audio ducking
- **D-03:** Play the rest-done ding through a `MediaPlayer` with
  `AudioAttributes.USAGE_ALARM`/`CONTENT_TYPE_SONIFICATION` after
  `AudioManager.requestAudioFocus(AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)` —
  Spotify (or whatever's playing) ducks for the ding instead of being
  drowned out or fighting it. Vibration goes through `VibratorManager`/
  `Vibrator` with `VibrationEffect.createWaveform` and
  `AudioAttributes.USAGE_ALARM`, more reliable than channel-default
  vibration and unaffected by the user's per-channel tweaks.

### Battery-manager guidance
- **D-04:** No code fix exists for a determined OEM battery killer
  (Xiaomi/Samsung/OnePlus-class) — `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` is
  explicitly out of scope (see `08-CONTEXT.md`'s non-goals). This phase adds
  an in-app guidance row/banner (Settings, near the Notifications card)
  telling the user to set the app to "Unrestricted" battery usage, shown
  once notifications are enabled — documentation as the fix, not a
  workaround.
</decisions>

<constraints>
## Technical Constraints

- Depends entirely on Phase 8's foreground service existing — none of this
  is buildable or testable in isolation.
- Same environment constraint as Phase 8: needs a real Android SDK + device,
  not available in the environment this phase was originally scoped in.
</constraints>
