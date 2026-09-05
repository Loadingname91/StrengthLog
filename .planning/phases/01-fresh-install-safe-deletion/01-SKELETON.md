# Walking Skeleton — FitLog (StrengthLog)

**Phase:** 1
**Generated:** 2026-09-05

## Capability Proven End-to-End

> A brand-new install of FitLog opens to a genuinely empty app (zero routines, zero session history) built on the app's existing full-stack architecture, and its single most destructive action — "Delete all data" — cannot fire without a deliberate, sustained press-and-hold gesture with visible progress feedback.

This is **not** a greenfield walking skeleton (framework/DB/deployment choices are not being made fresh) — FitLog is an already-shipped, working React + Vite + Capacitor app. This is Phase 1 of a *stabilization milestone* on that existing app, and it is the first phase to produce a `SUMMARY.md` in this milestone's `.planning/` history, which is why the orchestrator flagged it as the walking-skeleton phase. What follows documents the architecture that **already exists** and that this milestone's remaining phases (2–4) build on without renegotiating, plus the two new end-to-end capabilities this specific phase adds on top of it.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | React 19 + Vite 8 + React Router DOM 7, Tailwind CSS v4 | Already established pre-milestone; CLAUDE.md locks this stack for the whole milestone — no new frameworks |
| Data layer | `localStorage` only, single `useReducer` global state tree (`src/state/reducer.js`), whole-state JSON blob persisted on every change, keyed `fitlog:v1` (`src/state/storage.js`) | Fully offline-first per the app's Core Value; no backend/sync in scope this milestone |
| Auth | None — single local user per device, no login/session concept | App is a personal single-user log; `user: { name: 'Marcus' }` is a static display label, not an authenticated identity |
| Deployment target | Capacitor 8 native Android build (`android/` Gradle project via `gradlew.bat` on Windows), web assets rebuilt with `npm run build && npx cap sync android` before each native install | Only shipping target this milestone (per CLAUDE.md Platform constraint); no web hosting deployment in scope |
| Directory layout | `src/screens/` (route-level, store-connected), `src/components/` (presentational, prop-driven), `src/lib/` (pure framework-free logic), `src/state/` (reducer + context + persistence) | Pre-existing convention documented in `.planning/codebase/ARCHITECTURE.md`/`STRUCTURE.md`; this phase's edits (`StoreContext.jsx`, `ConfirmSheet.jsx`) fit directly into this layout with no new top-level directories |

## Stack Touched in Phase 1

- [x] Project scaffold (framework, build, lint) — **pre-existing, not re-scaffolded this phase**; `npm run build` / `npm run lint` are the automated gates every task in this phase's plans verify against.
- [x] Routing — **pre-existing, unaffected**; no new routes added or changed this phase.
- [x] Data layer — **one real write path changed this phase**: `src/state/StoreContext.jsx`'s `buildInitialState()` fresh-install branch now constructs and persists a genuinely empty state object instead of demo/seed data (plan 01-01). The existing-user read/write path (`if (persisted)` branch) is provably untouched.
- [x] UI — **one real interaction wired this phase**: the `ConfirmSheet` component's confirm button gains an opt-in `holdToConfirm` prop (a real pointer-event-driven, timer-backed gesture dispatching the existing `DELETE_ALL_DATA` reducer action), wired onto Settings' "Delete all data" call site only (plan 01-02).
- [x] Deployment — **pre-existing, unaffected**; the documented local-run (`npm run dev`) and native-build (`npm run build && npx cap sync android` → `gradlew.bat`) commands are unchanged by this phase.

## Out of Scope (Deferred to Later Slices)

- Any change to the hardcoded default user name (`user: { name: 'Marcus' }`) — explicitly declined this phase per CONTEXT.md D-03.
- Retaining any starter/demo routines for new installs — explicitly declined; new installs start with zero routines, full stop (D-01).
- A duration-override prop on `holdToConfirm` — UI-SPEC locks the hold at 1500ms with no per-call-site override; not built speculatively (see plan 01-02, Task 1).
- Distinguishing "corrupted localStorage" from "genuinely absent localStorage" in `src/state/storage.js`'s `loadState()` — flagged as an accepted, pre-existing risk in plan 01-01's threat model (T-01-01), not a fix pulled into this phase.
- Everything in Phases 2–4: persistent session bar, target-weight field, session-continuity across backgrounding/navigation, the full interaction-quality audit, and the Vitest + Testing Library suite (`TEST-01`–`TEST-04`) — none of this phase's plans introduce a test framework, since installing one is explicitly Phase 4's scope.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of the same architecture above, without altering it:

- Phase 2: Uninterrupted Workout Sessions — persistent floating session bar with a live clock, workout-in-progress survives navigation/backgrounding/hardware back, target-weight field in Routine Builder feeding Active Workout's ghost values.
- Phase 3: Interaction Quality Audit — every control on every screen manually exercised; defects fixed or explicitly deferred in PROJECT.md.
- Phase 4: Test Suite & Regression Safety Net — Vitest + Testing Library installed and configured for the first time in this milestone; `src/state/reducer.js` and this milestone's newest interactive features (delete long-press, target-weight field, session bar) get their first automated test coverage.
