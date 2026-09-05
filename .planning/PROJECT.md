# FitLog (StrengthLog)

## What This Is

A mobile-first, fully offline workout tracker for Android (React + Vite + Capacitor), matching the core mechanics of reference apps like StrengthLog — routine-based sessions, PR tracking, muscle-group heatmaps, and statistics — with CSV import/export and a warmer visual design the reference apps lack. Built for one user's own daily training log.

## Core Value

Logging a workout mid-session — weight, reps, RIR, rest — must be fast, reliable, and never lose data, even if the user backgrounds the app or navigates away mid-session.

## Requirements

### Validated

- ✓ Routine-based workout logging: create/edit routines, superset grouping, drag-to-reorder — existing
- ✓ Active workout session: per-set weight/reps/RIR entry, ghost placeholders from last session, auto rest timer, PR detection — existing
- ✓ Home dashboard, Stats hub (Overview/Muscles/Log/Measurements tabs), Measurements tracking — existing
- ✓ CSV Import and Export & Insights screens — existing
- ✓ Settings: units, theme, default rest, RIR display toggle, data management — existing
- ✓ Android packaging via Capacitor, with hardware/gesture back-button handling — existing (fixed this session)

### Active

- [ ] Remove seeded demo data (`src/lib/seed.js`) — first launch must start completely empty, no fake routines or 63 days of fake history
- [ ] "Delete all data" becomes a deliberate long-press/hold interaction (with visual hold progress) instead of a single tap, so a fat-finger tap can't wipe everything
- [ ] Add an optional target-weight field to Routine Builder exercise blocks, for when the user already knows what they want to lift, feeding into the Active Workout ghost/placeholder value
- [ ] Persistent global "workout in progress" mini-bar with a live elapsed-time clock, visible across every screen (not just inside Active Workout) while a session is running, tappable to jump back in
- [ ] Back-navigation out of Active Workout should feel intentional, not a dead end — resuming via the mini-bar or bottom-nav Log button must work reliably
- [ ] Systematic interaction audit across every screen — every button, toggle, and gesture actually does what it claims
- [ ] Introduce a real test suite (unit + interaction) — currently zero test coverage, which is exactly why small regressions like the ones above go unnoticed

### Out of Scope

- On-device/API-generated insights, shareable routine/summary cards, cloud sync/multi-device — original PRD's "Phase 3," deferred until this stabilization milestone ships
- Social features, coaching marketplace, nutrition tracking, wearable integration — excluded per original PRD non-goals

## Context

- Full product vision lives in `docs/app.md` (PRD) — screens, interaction rules, and the phased MVP cut this project already mostly implements
- Fresh codebase map lives in `.planning/codebase/` (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS) — `TESTING.md` confirms zero test framework currently exists; `CONCERNS.md` has the fuller technical-debt list
- App is fully offline/local-only: state persists to `localStorage` (`src/state/storage.js`), no backend, no auth, no external APIs
- This session already fixed two live bugs pre-dating this plan: the Settings "Delete all data" confirmation sheet not closing, and Android back-gesture exiting the app instead of navigating — both committed already
- User is testing on a real Android device via `npx cap sync android` + `gradlew.bat installDebug` from `android/`, on Windows/WSL
- Phase 3 interaction audit (QA-01/QA-02) deferred one finding rather than fixing it: `RoutineBuilder.jsx`'s drag-to-reorder gesture has no `visibilitychange`/`blur` safeguard against an interrupted drag (analogous to the Phase 1 hold-to-confirm backgrounding fix, CR-01), so an app-backgrounding event mid-drag could theoretically leave `dragId`/`dragY` in a stuck visual state until the next pointer event. Deferred because: (1) `onPointerCancel` already covers the overwhelming majority of real interruption cases, (2) reordering is non-destructive and fully reversible (unlike the delete gesture CR-01 protected), and (3) no data loss is possible either way — worst case is a cosmetic stuck drag-shadow correctable by any subsequent tap.

## Constraints

- **Tech stack**: React 19, Vite, Tailwind v4, react-router v7, Capacitor 8 (Android only) — stay within this stack, no new frameworks
- **Data**: fully local via `localStorage`, offline-first — no backend/sync work in this milestone
- **Platform**: Android via Capacitor; native build runs from `android/` on Windows (`gradlew.bat`), web assets rebuilt via `npm run build && npx cap sync android` before each native install
- **Testing**: no framework installed yet; introducing one (recommended: Vitest + Testing Library per `.planning/codebase/TESTING.md`) is explicitly in scope this milestone

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Long-press hold for "Delete all data" instead of a second confirm tap | User fat-fingered the existing single-tap confirm; a hold gesture with visual progress is much harder to trigger by accident | — Pending |
| Global persistent workout session bar instead of only an in-screen timer | User expects to see a running session anywhere in the app, not just on the Active Workout screen, and wants live elapsed time visible at a glance | — Pending |
| Add a test suite this milestone rather than deferring it | User explicitly linked "no unit tests" to the quirks being found; safety net is a stated goal, not a nice-to-have | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-05 after initialization*
