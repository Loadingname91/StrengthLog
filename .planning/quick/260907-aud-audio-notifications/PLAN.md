---
quick_id: 260907-aud
slug: audio-notifications
date: 2026-09-07
status: planned
---

# Quick Task: Audio for reminders, PR, and rest-done notifications

See `/home/hitesh/.claude/plans/i-wanna-plan-to-melodic-wren.md` (the approved plan) for full
context and reasoning. Summary:

FitLog's notification audio depends on the phone's own system-wide default notification sound
(`fitlog_reminders_v1`/`fitlog_pr_v1` never set a `sound` field, and the rest-done ding uses
`RingtoneManager.getDefaultUri()`). If that system default is silent — plausible, this project's
screenshots show a Samsung/One UI device — every one of these silently fails despite the code
otherwise being correct (the rest-done ding's audio-focus ducking, for instance, still works
correctly; the music just never actually ducks for anything audible).

Fix: bundle the app's own short chime as a native `res/raw/` asset instead of depending on the
system default, for all three notification types. Version-bump the two JS-created channels
(`_v1` → `_v2`) since channels are immutable after first creation on a device. No Settings UI
change — sound rides along with each notification type's existing enable toggle.

## Verification

- `npm test`, `npm run lint`, `npm run build` all clean
- Manual, on-device (native-boundary change, same as every notification phase in this milestone):
  trigger each of rest-done / PR / a reminder and confirm audible sound + vibration, ideally with
  the phone's own default notification sound set to silent (the actual condition being fixed)
