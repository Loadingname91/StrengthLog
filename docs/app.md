# FitLog — Product Requirements Document
### A StrengthLog-style workout tracker with CSV import/export, session timers, and muscle heatmaps

---

## 1. Overview

**Goal:** a mobile-first workout logging app matching the core mechanics of the reference app (routine-based sessions, PR tracking, muscle-group heatmaps, statistics), plus three capabilities it lacks: CSV import of existing programs, exportable AI-style insights, and a cleaner, warmer visual language.

**Platform:** mobile-first (iOS/Android), responsive enough to use on a tablet/desktop for CSV import and reviewing stats.

**Non-goals for v1:** social features, coaching marketplace, nutrition tracking (a separate existing tool already covers that), wearable integration.

---

## 2. Design System — "Anthropic-style"

Warm, quiet, high-contrast-on-content rather than high-decoration. The reference app's dark-navy/red-alert aesthetic is replaced with:

- **Palette:** warm off-white/cream background (`#F7F5F1`-ish) in light mode, warm charcoal (`#2B2A28`-ish) in dark mode — not pure black. One accent color, a muted terracotta/clay (`#C1633A`-ish), used sparingly for primary actions, PR badges, and active states only. Muscle heatmap uses a controlled warm gradient (pale sand → terracotta → deep rust) instead of the reference app's saturated red, so intensity is still legible in one glance.
- **Typography:** one clean sans-serif for UI (numbers get tabular figures so weight/rep columns align), a slightly warmer serif or humanist sans reserved for headers/empty-state copy to avoid an all-clinical feel.
- **Shape language:** generously rounded corners (16-20px), soft 1px borders instead of heavy drop shadows, generous whitespace — cards should feel like paper, not glass.
- **Motion:** minimal, purposeful — a set completing gets a small check animation, a PR gets a brief one-time badge animation, nothing else animates without reason.
- **Icons:** line-weight icons, consistent stroke width, no filled/glyph mixing.

---

## 3. Information Architecture

**Bottom navigation (5 tabs, persistent):**
1. **Home** — today's plan, quick stats, goals
2. **Stats** — analytics hub
3. **Log** (center, elevated `+` button) — start/resume a workout, or quick-add a set
4. **Routines** — templates/program library
5. **Settings**

Screens reachable from these five: Workout Session, Exercise Detail, Measurements, CSV Import, Export & Insights, Exercise Library, Routine Builder.

---

## 4. Screens

### 4.1 Home / Dashboard

**Purpose:** orientation — what's today's session, how am I trending, any goals close to done.

**Elements, top to bottom:**
- Header: avatar/initial, "Welcome back, {name}" or username, small calendar icon (top right) opening a date-jump picker
- **Today's session card** (new, not in reference app): shows the next routine in sequence (e.g. "Upper A") with a one-line exercise preview and a prominent **"Start Workout"** button — this is the single most important tap target on the screen, sits above the fold
- **Goals** section: 2-3 progress bars (e.g. "30 sets for chest this week — 18/30", "10 workouts this month — 4/10"), each tappable to see the underlying log entries. Add-goal `+` affordance at the end of the list.
- **Overview chart**: line/bar toggle, date-range dropdown (7/30/90 days, custom), plots workouts, volume, or a chosen exercise's top set — user picks the metric via a small segmented control above the chart
- **Muscles worked** (last 7 days): compact front/back body heatmap, tap to expand to full Stats screen
- Empty state (no workouts logged yet): replace the chart and heatmap with a single illustration + "Log your first workout" CTA, no locked/blurred placeholders — never gate a core view behind an upsell blur the way the reference app does with "Unlock Muscles Worked."

**Interactions:**
- Tap today's session card body (not the button) → Workout Overview screen (4.4) for that routine, without starting the timer
- Tap Start Workout → jumps straight into Active Workout (4.5), timer running
- Long-press a goal → edit/delete
- Pull-to-refresh recalculates all stats

---

### 4.2 Routines / Templates List

**Purpose:** manage the program — the ordered rotation (Upper A → Lower A → Upper B → …) rather than fixed weekdays, matching how the user actually trains.

**Elements:**
- List of routine cards, each showing: name ("Upper A"), a tag for its position in the rotation ("Session 1 of 6"), exercise count, estimated duration, small muscle-heatmap thumbnail
- Drag handle on each card to reorder the rotation
- `+ New Routine` button, always visible (floating or pinned to list bottom)
- Toggle at top: "Sequence mode" (default — always shows "next up" on Home regardless of weekday) vs "Weekday mode" (pins routines to calendar days) — this directly reflects a real pain point the reference app doesn't solve

**Interactions:**
- Tap a card → Workout Overview (4.4)
- Swipe left on a card → Edit / Duplicate / Delete
- Tap `+ New Routine` → Routine Builder (4.3)

---

### 4.3 Routine Builder

**Purpose:** construct or edit a routine, including supersets — the reference app's own superset handling was a recurring source of confusion in testing, so this needs to be explicit.

**Elements:**
- Routine name field, rotation-position field
- Ordered list of exercise blocks. Each block is either a **single exercise** (straight sets) or a **superset group** (2-3 exercises bundled)
- Per exercise: sets, target rep range (min-max, not a single number), target rest, RIR target (optional, e.g. "2 RIR")
- **"Group as superset"** button appears when 2+ adjacent exercises are multi-selected — visually bundles them with a bracket/connector in the list and a single shared rest timer setting for after the group, distinct from zero rest between the paired exercises
- `+ Add Exercise` opens Exercise Library (4.12) in a sheet
- Reorder via drag handles

**Interactions:**
- Multi-select exercises (checkbox mode toggled by a "Select" button) → "Group as superset" or "Ungroup"
- Save button always visible in header, disabled until name + ≥1 exercise present

---

### 4.4 Workout Overview (pre-session)

**Purpose:** matches the reference app's screen closely — this pattern already works well.

**Elements (as in the reference screenshot, refined):**
- Back + share icons in header
- Muscle heatmap (front/back figure), color-coded by primary/secondary emphasis for *this specific routine*
- Routine name + rotation label ("Session 3 of 6" instead of a fixed weekday)
- Stat row: Exercises / Total reps / Total sets
- **Start Workout** button (full-width, primary color) + estimated duration badge with a clock icon
- Exercise preview cards below, each showing name, target sets×reps, and a small history sparkline (7-point mini line chart of the last 7 sessions' top set) — this is new versus the reference app, gives at-a-glance "am I progressing" before even starting

**Interactions:**
- Tap Start Workout → Active Workout (4.5)
- Tap an exercise card → Exercise Detail (4.6), without starting the session
- Tap share icon → generates a shareable image/summary card of the routine

---

### 4.5 Active Workout / Logging Screen

**Purpose:** the core, highest-frequency screen. Must be fast to use one-handed, mid-set, possibly sweaty hands.

**Elements:**
- Header: routine name, live elapsed-time counter, a subtle progress bar for exercises completed/total
- **Current exercise card**, large: name, target range, a help `?` icon opening a form-cue note or short video loop
- **Set rows**: set number, weight input (numeric keypad, remembers last-used unit), reps input, an RIR quick-select (0/1/2/3+ as tap chips, not a text field), a checkmark button to mark the set done
- Previous session's numbers shown as faint placeholder text in each input (pre-fill on tap) — directly solves the "what did I lift last time" friction
- **PR badge**: auto-fires when a logged set beats the stored best for that exercise (weight × reps basis), small non-blocking animation, doesn't interrupt logging flow
- **Rest timer**: auto-starts the moment a set is checked off, shows as a countdown ring around a central time readout, with **+15s / -15s** adjust buttons and a **Skip** button; a subtle vibration/sound at zero. For superset pairs, the timer only starts after the *second* exercise in the pair is logged — the UI visually indicates "no rest — next exercise" between the paired lifts instead of showing a timer
- Swipe left/right (or a bottom exercise-pill carousel) to move between exercises in the session without losing entered-but-unconfirmed data
- **Add Set** / **Remove Set** controls per exercise, in case the day calls for more or fewer than planned
- **Finish Workout** button, always reachable (sticky footer), triggers a summary screen (total volume, PRs hit, duration, one-tap "add a note") before saving

**Interactions:**
- Tap weight/reps field → numeric keypad, "last time" ghost text becomes the value on single tap
- Long-press a completed set → edit or delete
- Swipe a set row left → delete
- Finish Workout mid-exercise (not all sets logged) → confirmation sheet, not a silent auto-discard

---

### 4.6 Exercise Detail / History

**Purpose:** per-exercise deep dive — this doesn't exist as a standalone screen in the reference app and is the single highest-value addition for someone actually trying to judge progressive overload.

**Elements:**
- Exercise name, muscle group tags (primary/secondary)
- **Progress chart**: weight over time (line), with a toggle for weight / estimated 1RM / volume / reps — date-range selector shared with the Stats screen's convention
- All-time PR, PRs by rep range (e.g. best @ 5 reps, best @ 8 reps, best @ 12 reps) shown as a small table, since "PR" is rep-range-dependent, not a single number
- Full session-by-session log table below the chart: date, sets, weight × reps, RIR
- Notes/cues field (persists across sessions, editable)

**Interactions:**
- Tap a chart point → jumps to that session's full log entry
- Tap a log row → edit that specific historical entry

---

### 4.7 Statistics Hub

**Purpose:** consolidates what the reference app spreads across three separate scroll-heavy screens (Images 3, 4, 5) into fewer, clearer views.

**Elements, organized as tabs (not one long scroll):**
- **Overview tab**: date-range selector, workout-frequency bar chart, workout-average stat grid (exercises/sets/reps/avg weight/volume/time), weekly-average stat grid — same data as the reference app's "Workout average" and "Weekly average" cards, but tab-separated instead of stacked
- **Muscles tab**: full unlocked (no premium blur, ever, for a core stat) front/back heatmap, plus a bar chart "Most trained muscle groups (sets/week)" with Primary/Secondary legend, plus "Most trained exercises" ranked list
- **Log tab**: chronological training log, filterable by routine or exercise, each entry expandable inline
- **Measurements tab**: links to 4.9

**Interactions:**
- Tap any muscle on the heatmap → filters the "Most trained exercises" list to that muscle
- Tap a bar in the frequency chart → jumps to that day's training log entry

---

### 4.8 Measurements

**Purpose:** body measurement tracking, separate from workout logging, since it's typically weekly not per-session.

**Elements:**
- Quick-add form: bodyweight, waist, chest, biceps, neck (matches the fields already in use), date defaults to today, notes field
- Trend charts per measurement, small multiples (one compact chart per metric) rather than one crowded combo chart
- A "waist trend" callout on Home if the user has set a target measurement, showing progress toward it (not raw body-fat %, per established preference for tape trend over formula estimates)

**Interactions:**
- Tap a metric's chart → expands to full-screen with date-range control
- Swipe a past entry → edit/delete

---

### 4.9 CSV Import

**Purpose:** the capability the reference app explicitly lacks (its own import only accepts its own export format). This needs to be genuinely generic.

**Flow, step by step:**
1. **Select file** — file picker, accepts .csv
2. **Column mapping screen** — the app shows detected column headers from the uploaded file as a list, with a dropdown next to each to map it to an internal field (Exercise name / Date / Set # / Weight / Reps / RIR / Notes / Ignore this column). Auto-detects common headers (e.g. recognizes "exercise_title" or "Exercise" without the user mapping manually) but never assumes silently — mapping is always shown and editable before import
3. **Preview screen** — shows the first ~10 rows as they'll be imported, with any rows that fail validation (missing weight, unparseable date) flagged in a warning color and excluded by default, with a toggle to include them anyway as incomplete entries
4. **Unit confirmation** — asks kg or lb once if not detectable from the data, applies to the whole import
5. **Confirm & Import** — progress bar for large files, then a summary screen: "142 sets imported across 6 sessions, 3 rows skipped" with a link to review skipped rows

**Interactions:**
- Save a column mapping as a named preset (so repeat imports from the same source, e.g. a specific app's export, skip the mapping step next time)
- Cancel at any step discards nothing already in the app — import is additive, never overwrites existing history

---

### 4.10 Export & Insights

**Purpose:** the other missing capability — getting data *out* in a usable form, plus a summarized read on it.

**Elements:**
- Date-range picker (defaults to "all time")
- **Export format** choice: raw CSV (full column set, suitable for re-import or spreadsheet analysis) or a formatted PDF summary
- **Insights** section (generated on-device or via a lightweight summary call, not raw export): plain-language callouts such as "Bench Press: +7.5kg over 8 weeks, on pace" or "Hamstring volume has been flat for 3 weeks" — short, factual, sourced directly from the logged numbers, no more than a handful of callouts at a time so it stays useful rather than noisy
- Share sheet integration for both the file and a text summary

**Interactions:**
- Tap an insight card → jumps to the relevant Exercise Detail or Muscles tab
- Export button disabled with an explanatory label if the selected date range has no data

---

### 4.11 Exercise Library / Picker

**Purpose:** searchable list backing both Routine Builder and mid-workout exercise swaps.

**Elements:**
- Search bar (matches on name and alias, e.g. "OHP" finds "Overhead Press")
- Filter chips: muscle group, equipment (barbell/dumbbell/cable/machine/bodyweight)
- Each result row: name, muscle tags, small icon for equipment type
- "Create custom exercise" always available at the bottom of results, for gym-specific or substitute movements

**Interactions:**
- Tap a result → adds to whatever flow launched the picker (Routine Builder or an in-session swap) and returns

---

### 4.12 Settings

**Elements:**
- Units (kg/lb), theme (light/dark/system)
- Default rest timer durations, RIR display on/off
- Goals management (create/edit/delete the Home screen progress bars)
- Data: Import (4.9), Export (4.10), full data delete (with confirmation)
- Account (if cloud sync is in scope) or "Local only" indicator if not

---

## 5. Cross-cutting interaction rules

- **No feature is ever shown blurred behind a paywall prompt.** The reference app's "Unlock Muscles Worked" pattern is explicitly excluded — if a feature exists, it's available; if it doesn't exist yet, it's simply absent from the UI rather than teased.
- **Every numeric input remembers its last value as a ghost placeholder**, one-tap to accept.
- **Undo, not just confirm, on destructive actions** where feasible (a brief "Set deleted — Undo" snackbar beats a confirmation dialog for low-stakes actions like a single set; a confirmation dialog is reserved for high-stakes ones like deleting a whole routine or all data).
- **Rest timer always visible during a session**, even when scrolled away from it, as a persistent mini-bar.

---

## 6. MVP scope cut

**Phase 1 (MVP):** Home, Routines list + basic Builder (straight sets only, superset grouping can follow), Workout Overview, Active Workout with timer, basic Stats (Overview + Muscles tabs), Measurements, Settings.

**Phase 2:** CSV Import, Export & Insights, Exercise Detail history charts, saved import-mapping presets, custom exercise creation.

**Phase 3:** Insights generated via a small on-device model or API call rather than static callouts, shareable routine/summary cards, cloud sync/multi-device.

Building Phase 1 end-to-end and using it for a couple of real weeks before touching Phase 2 is the better order — same principle as not switching a training program before it's had a fair test.

## Using Claude design



Use the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via /design-login) to import this project:
https://claude.ai/design/p/3c63abbf-42ce-4b96-bbe4-f773c9a1b9d0?file=FitLog.dc.html

Focus on these files (the whole project is readable):
- `FitLog.dc.html`

Also read these files the selection imports:
- `android-frame.jsx`
- `support.js`

Implement: `FitLog.dc.html`