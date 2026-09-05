# Phase 5: Fast Set Entry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 5-Fast Set Entry
**Areas discussed:** Auto-progress behavior on weight/reps input

---

## Auto-progress input behavior

User's original ask: "make the inputs for the set like reps, weights etc big so that
when im using phone it is easy inputed and progress as and when field is filed like
other apps."

### What should "progress as and when field is filled" mean?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-advance focus | Completing a value (Enter/keyboard-Next/blur) moves focus to the next logical field — Weight → Reps → next set's Weight — like OTP-style input chaining. | ✓ |
| Auto-mark set done | Once both Weight and Reps are filled, the set is automatically checked off, without a separate tap on the checkmark. | ✓ |
| Both | Auto-advance AND auto-mark-done together. | ✓ (selected) |

**User's choice:** Both.

---

## Claude's Discretion (raised during design, not asked back to the user)

### Should focus advance on every keystroke, or on a confirm action?

Not asked directly — a weight/reps field is a free-form decimal/integer number,
not a fixed-length code (unlike an OTP field), so advancing on every keystroke
would make it impossible to type a 2+ digit value (e.g. typing "1" of "12" would
immediately jump away). Advancing only on an explicit confirm action (Enter key,
the mobile keyboard's "Next"/"Done" action via `enterKeyHint`, or blur with a
valid non-empty value) is the only interpretation that doesn't break multi-digit
entry. Documented as a design decision in CONTEXT.md rather than re-asked, since
the alternative isn't actually viable.

### Should auto-mark-done fire on every keystroke once both fields happen to look valid?

Same reasoning — fires on confirm (blur/Enter) of whichever field is filled
second, not on every keystroke, to avoid marking a set done mid-type (e.g. typing
"1" then "10" for reps would otherwise flicker done/not-done).

### Should editing a field after auto-completion un-mark the set?

No — matches the existing manual-toggle precedent (SetRow's fields are already
editable regardless of `done` state; toggling is a separate explicit action).
Auto-mark-done is a one-way trigger from not-done → done; going the other way
stays a manual tap on the checkmark, same as today.
