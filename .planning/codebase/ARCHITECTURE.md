<!-- refreshed: 2026-09-05 -->
# Architecture

**Analysis Date:** 2026-09-05

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                       Entry / Shell                          │
│   `src/main.jsx`  →  `src/App.jsx` (BrowserRouter + Shell)   │
├──────────────────┬──────────────────┬───────────────────────┤
│   Screens         │  Shared UI        │  Providers            │
│  `src/screens/*`  │ `src/components/*`│ `src/state/*Context`  │
└────────┬──────────┴────────┬──────────┴──────────┬────────────┘
         │                   │                     │
         ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  State Layer (single store)                  │
│  `src/state/StoreContext.jsx` (useReducer + Context)          │
│  `src/state/reducer.js` (all mutations)                       │
└────────┬────────────────────────────────────────┬─────────────┘
         │                                        │
         ▼                                        ▼
┌───────────────────────────┐        ┌─────────────────────────┐
│  Derived data / selectors  │        │  Persistence             │
│  `src/lib/selectors.js`    │        │  `src/state/storage.js`  │
│  `src/lib/insights.js`     │        │  (localStorage, key      │
│  `src/lib/schedule.js`     │        │  `fitlog:v1`)             │
└───────────────────────────┘        └─────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App / Shell | Router setup, bottom-nav visibility rules, Android hardware back-button handling (Capacitor) | `src/App.jsx` |
| StoreProvider | Owns the single global `useReducer` state, persists to localStorage on every change, applies theme (light/dark/system) to `<html data-theme>` | `src/state/StoreContext.jsx` |
| reducer | Pure function implementing every state transition (routines, workouts, goals, settings, measurements, exercises) | `src/state/reducer.js` |
| storage | localStorage read/write wrapper, swallows quota/parse errors | `src/state/storage.js` |
| ToastProvider | Transient toast/snackbar notifications, separate Context from the data store | `src/state/ToastContext.jsx` |
| lib/selectors | Pure read-only derivations from state (chart series, PRs, volumes, muscle set counts) | `src/lib/selectors.js` |
| lib/schedule | Weekday-mode scheduling logic (due dates, week-strip data, restart handling) | `src/lib/schedule.js` |
| lib/exercises | Static exercise catalog + lookup by id | `src/lib/exercises.js` |
| lib/muscles | Muscle-group metadata and heatmap intensity calculation | `src/lib/muscles.js` |
| lib/seed | Generates demo/seed data for first-run state | `src/lib/seed.js` |
| lib/csv, lib/csvImport | CSV export/import parsing and mapping to internal session model | `src/lib/csv.js`, `src/lib/csvImport.js` |
| lib/format, lib/id, lib/rng | Small pure utilities (dates/formatting, id generation, seeded RNG) | `src/lib/format.js`, `src/lib/id.js`, `src/lib/rng.js` |
| Screens | One React component per route; each screen owns its local UI state and reads/dispatches to the store directly (no intermediate view-model layer) | `src/screens/*.jsx` |
| Components | Presentational/reusable UI pieces (charts, cards, nav, sheets) with no direct store access — driven entirely by props | `src/components/*.jsx` |

## Pattern Overview

**Overall:** Client-only single-page React app with a Redux-style reducer (`useReducer` + Context) as the single source of truth, persisted to `localStorage`. No backend/server component. Packaged as a native Android app via Capacitor for a hybrid web/native shell.

**Key Characteristics:**
- Single global state tree — no separate stores per feature/domain.
- All state mutation flows through one `reducer.js` via `dispatch`; screens never mutate state directly.
- Derived/computed data (charts, stats, PRs) is never stored — always recomputed via selector functions in `lib/selectors.js` and memoized locally with `useMemo` in screens.
- Persistence is a side effect layered on top of the reducer (`useEffect` in `StoreContext.jsx` calls `saveState` whenever `state` changes) — not baked into the reducer itself.
- Routing-driven code splitting is not used; all screens are statically imported in `App.jsx`.

## Layers

**Presentation (screens + components):**
- Purpose: Render UI, collect user input, dispatch actions.
- Location: `src/screens/`, `src/components/`
- Contains: Route-level screens (stateful, connected to store) and shared presentational components (stateless, prop-driven).
- Depends on: State layer (`useStore`), lib utilities for formatting/derivations.
- Used by: `src/App.jsx` route table.

**State layer:**
- Purpose: Single source of truth for all persisted application data; encapsulates all mutation logic.
- Location: `src/state/`
- Contains: `StoreContext.jsx` (provider + hook), `reducer.js` (transitions), `storage.js` (persistence), `ToastContext.jsx` (ephemeral UI state, separate from the data store).
- Depends on: `lib/seed.js` (initial data), `lib/schedule.js` (backfill logic for weekday assignments).
- Used by: Every screen via `useStore()`.

**Domain/lib layer:**
- Purpose: Pure, stateless business logic — computing schedules, stats, chart series, CSV parsing, exercise catalog lookups.
- Location: `src/lib/`
- Contains: Plain `.js` modules exporting pure functions; no React, no side effects (except `format.js`'s date-now calls).
- Depends on: Nothing internal except each other (e.g., `selectors.js` imports `exercises.js`, `format.js`).
- Used by: Screens and `reducer.js`.

## Data Flow

### Primary Request Path (starting a workout)

1. User taps "Start" on `Home` (`src/screens/Home.jsx:45-48`), which calls `dispatch({ type: 'START_WORKOUT', payload: { routineId } })`.
2. `reducer.js` handles `START_WORKOUT`-style actions and constructs an active-workout object from the routine's blocks (`buildActiveWorkoutFromRoutine`, `src/state/reducer.js:10-37`).
3. Updated state flows back through `StoreProvider`; its `useEffect` (`src/state/StoreContext.jsx:31-33`) persists it to `localStorage` via `saveState` (`src/state/storage.js:12-18`).
4. `navigate('/workout')` (react-router) renders `ActiveWorkout.jsx`, which reads `state` via `useStore()` and dispatches further set-completion actions.

### Stats / Insights Flow

1. `StatsHub`/`Home` read raw `state.sessions` from the store.
2. Screens call pure selector functions (`chartSeries`, `muscleSetCounts`, `goalProgress`, etc. in `src/lib/selectors.js`) inside `useMemo`, keyed on `state.sessions` and local UI filters (metric, range).
3. Selector output is passed as props to presentational chart components (`LineChart.jsx`, `BodyHeatmap.jsx`, `Sparkline.jsx`) which render but never touch the store.

**State Management:**
- Single `useReducer` instance created once in `StoreProvider`, exposed to the whole tree via React Context (`useStore()` hook in `src/state/StoreContext.jsx`).
- No middleware, no async thunks — all actions are synchronous, in-memory reducer updates.
- Persistence is fire-and-forget: every state change is serialized to `localStorage` on the next effect tick (whole-state JSON blob, key `fitlog:v1`).
- Toasts use a fully separate Context (`ToastContext.jsx`) so ephemeral UI feedback doesn't get persisted or bloat the reducer.

## Key Abstractions

**Routine / Block / Exercise:**
- Purpose: A `routine` is an ordered list of `blocks` (straight set or superset), each block references one or more `exerciseIds` with target sets/reps/rest.
- Examples: `src/screens/RoutineBuilder.jsx`, `src/lib/exercises.js`
- Pattern: Routines are templates; `buildActiveWorkoutFromRoutine` (`src/state/reducer.js:10`) expands a routine into a concrete, mutable "active workout" instance for logging.

**Session:**
- Purpose: A completed workout record stored in `state.sessions`, the append-only source for all stats/PR/chart calculations.
- Examples: consumed throughout `src/lib/selectors.js`, `src/lib/insights.js`.
- Pattern: Immutable historical log; new sessions are appended, never mutated after completion.

**Weekday Schedule:**
- Purpose: Maps routines to weekdays (`state.weekdayAssignments`) to compute "due" status and the week-strip calendar.
- Examples: `src/lib/schedule.js`, `src/components/WeekStrip.jsx`
- Pattern: Pure derivation from `weekdayAssignments` + `sessions` + `scheduleRestartAt`, recomputed on render — no separate schedule state to keep in sync.

## Entry Points

**Web/App bootstrap:**
- Location: `src/main.jsx`
- Triggers: Vite dev server / production bundle load.
- Responsibilities: Mounts React root, wraps app in `StoreProvider` and `ToastProvider`.

**Router shell:**
- Location: `src/App.jsx`
- Triggers: Any navigation within the SPA.
- Responsibilities: Defines the full route table, conditional bottom-nav rendering (`showNavFor`), and Capacitor Android back-button interception (`useAndroidBackButton`).

**Native shell (Android):**
- Location: `android/` (Capacitor-generated project), `capacitor.config.json`
- Triggers: Building/running the Android app via Capacitor CLI.
- Responsibilities: Wraps the built web bundle (`dist/`) in a native WebView shell; exposes `@capacitor/app` APIs (e.g., back button) consumed in `App.jsx`.

## Architectural Constraints

- **Threading:** Single-threaded browser/WebView execution; no workers or background threads.
- **Global state:** One global singleton store via React Context (`StoreContext.jsx`); a second, independent global singleton for toasts (`ToastContext.jsx`). No other module-level mutable state observed.
- **Circular imports:** None observed; `lib/` modules are leaf dependencies with no imports back into `state/` or `screens/`.
- **Persistence model:** Whole-state serialization on every change (no partial/incremental writes, no schema migrations beyond ad-hoc backfill checks in `buildInitialState`, `src/state/StoreContext.jsx:9-16`).
- **No backend:** All data lives client-side in `localStorage`; CSV import/export (`lib/csv.js`, `lib/csvImport.js`) is the only data interchange mechanism.

## Anti-Patterns

### God reducer with embedded construction logic

**What happens:** `reducer.js` (270 lines) contains both pure state-transition switch cases and non-trivial helper functions like `buildActiveWorkoutFromRoutine` and `isLastInPair` that build derived object graphs.
**Why it's wrong:** Mixes "how state changes" with "how domain objects are shaped," making the reducer harder to test in isolation and growing unbounded as more action types are added.
**Do this instead:** New complex object-construction logic for actions should be extracted into `src/lib/` as a pure helper (as `blockTarget`, `bestProductForExercise` already are) and imported into the reducer, keeping the reducer switch itself thin.

### Screens directly coupled to store shape

**What happens:** Screens (e.g., `Home.jsx`) reach into `state.routines`, `state.sessions`, `state.weekdayAssignments` etc. directly and recompute derived values inline with `useMemo`, rather than through a consistent selector API.
**Why it's wrong:** Changes to state shape require hunting through every screen; some derivations exist only in `lib/selectors.js` while others (like `nextRoutine` lookup in `Home.jsx:24-25`) are inlined ad hoc in the component.
**Do this instead:** Route all cross-cutting derivations (e.g., "next routine for today") through `src/lib/selectors.js` or `src/lib/schedule.js` so screens stay declarative and state-shape changes have one blast radius.

## Error Handling

**Strategy:** Defensive, silent-failure style for storage; no global error boundary observed.

**Patterns:**
- `storage.js` wraps `localStorage` calls in try/catch and returns `null`/no-ops on failure (quota exceeded, private browsing, corrupt JSON) — `src/state/storage.js:3-18`.
- No `ErrorBoundary` component found in `src/components/`; unhandled render errors would surface as a blank screen in production.

## Cross-Cutting Concerns

**Logging:** No structured logging or telemetry; likely relies on browser/WebView console only.
**Validation:** Input validation is inline within screens/forms (no shared schema/validation library dependency in `package.json`).
**Authentication:** None — single-user, local-only app (`state.user` is a static display name, not an auth identity).
**Theming:** Centralized in `StoreContext.jsx` via `data-theme` attribute driven by `state.settings.theme`, reacting to `prefers-color-scheme` media query changes.

---

*Architecture analysis: 2026-09-05*
