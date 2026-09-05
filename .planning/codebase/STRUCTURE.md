# Codebase Structure

**Analysis Date:** 2026-09-05

## Directory Layout

```
StrengthLog/
├── src/
│   ├── main.jsx            # App bootstrap (createRoot, providers)
│   ├── App.jsx              # Router + shell (routes, bottom nav, back button)
│   ├── index.css            # Global styles / Tailwind entry
│   ├── screens/             # One component per route (page-level)
│   ├── components/          # Reusable, mostly presentational UI pieces
│   ├── state/                # Global store: Context, reducer, persistence, toasts
│   ├── lib/                  # Pure domain logic and utilities (no React)
│   └── assets/               # Static assets bundled by Vite
├── public/                   # Static files served as-is (favicon, etc.)
├── android/                  # Capacitor-generated native Android project
├── dist/                     # Vite production build output (generated)
├── docs/                     # Project documentation (e.g., app-depend.md)
├── .planning/                # GSD planning artifacts (codebase docs, phases)
├── capacitor.config.json     # Capacitor native-shell configuration
├── vite.config.js            # Vite build/dev config (implied by scripts)
├── package.json              # Dependencies and scripts
└── index.html                # Vite HTML entry point
```

## Directory Purposes

**`src/screens/`:**
- Purpose: Top-level route components, one per URL path defined in `src/App.jsx`.
- Contains: Stateful React components that call `useStore()` for data and dispatch actions directly; own local UI state (filters, form fields, modals) via `useState`.
- Key files: `Home.jsx` (dashboard), `ActiveWorkout.jsx` (in-progress workout logging), `RoutineBuilder.jsx` (largest screen, 321 lines — create/edit routine), `StatsHub.jsx` (charts/insights), `WorkoutOverview.jsx`, `WorkoutSummary.jsx`, `Routines.jsx`, `ExerciseLibrary.jsx`, `ExerciseDetail.jsx`, `Measurements.jsx`, `CsvImport.jsx`, `ExportInsights.jsx`, `Settings.jsx`.

**`src/components/`:**
- Purpose: Shared, reusable UI building blocks used across multiple screens.
- Contains: Presentational components that receive data via props and do not call `useStore()` directly (verified pattern: charts/cards/nav are prop-driven).
- Key files: `BottomNav.jsx` (tab bar), `Card.jsx`, `ConfirmSheet.jsx` (confirmation modal), `Icons.jsx` (SVG icon set), `LineChart.jsx`, `Sparkline.jsx`, `BodyHeatmap.jsx` (muscle heatmap), `WeekStrip.jsx` (weekday calendar strip), `ProgressBar.jsx`, `SegmentedControl.jsx`.

**`src/state/`:**
- Purpose: Application-wide state management and persistence.
- Contains: `StoreContext.jsx` (Context provider + `useStore` hook, owns the `useReducer` instance and localStorage sync effect), `reducer.js` (all action-type handling), `storage.js` (localStorage read/write with error swallowing), `ToastContext.jsx` (separate Context for transient toast notifications).

**`src/lib/`:**
- Purpose: Framework-agnostic domain logic — pure functions with no React dependency, safe to unit test in isolation.
- Contains: `exercises.js` (static exercise catalog + `exerciseById`), `selectors.js` (derive stats/charts/PRs from `sessions`), `schedule.js` (weekday-mode due-date logic), `muscles.js` (muscle group metadata + heatmap intensity), `insights.js` (higher-level derived insights), `seed.js` (demo/seed data generator, 244 lines), `csv.js` / `csvImport.js` (export/import parsing), `format.js` (date/number formatting helpers), `id.js` (`uid()` generator), `rng.js` (seeded random number generator, used by `seed.js`).

**`src/assets/`:**
- Purpose: Static assets imported directly by components (e.g., `vite.svg`).
- Generated: No. Committed: Yes.

**`android/`:**
- Purpose: Native Android project generated and managed by Capacitor (`npx cap add android` / `npx cap sync`).
- Generated: Yes (scaffolded by Capacitor tooling, then customized). Committed: Yes (present in git status as untracked, pending first commit).

**`dist/`:**
- Purpose: Vite production build output.
- Generated: Yes (via `npm run build`). Committed: No (should stay in `.gitignore`).

**`docs/`:**
- Purpose: Human-authored project documentation (e.g., `app-depend.md` describing dependencies).
- Generated: No. Committed: Yes.

## Key File Locations

**Entry Points:**
- `src/main.jsx`: React root mount, provider composition.
- `src/App.jsx`: Route table, bottom-nav visibility logic, Android back-button handling.
- `index.html`: Vite HTML entry (implied standard Vite layout).

**Configuration:**
- `package.json`: Scripts (`dev`, `build`, `lint`, `preview`) and dependencies.
- `capacitor.config.json`: Native app id/name and web-asset directory for Capacitor.
- `vite.config.js` (implied, not read directly): Vite + Tailwind + React plugin config.

**Core Logic:**
- `src/state/reducer.js`: All state-mutation logic — the single place new actions must be added.
- `src/state/StoreContext.jsx`: Store wiring, persistence effect, theme effect.
- `src/lib/selectors.js`: All cross-screen derived-data calculations.
- `src/lib/schedule.js`: Weekday scheduling due-date and week-strip logic.

**Testing:**
- Not detected. No `*.test.*`/`*.spec.*` files, no test runner config (Jest/Vitest) present in `package.json` or the file tree.

## Naming Conventions

**Files:**
- React components: PascalCase with `.jsx` extension (`Home.jsx`, `BottomNav.jsx`, `LineChart.jsx`).
- Pure logic/utility modules: lowercase with `.js` extension (`selectors.js`, `format.js`, `schedule.js`).

**Directories:**
- Plural, lowercase, purpose-based (`screens`, `components`, `state`, `lib`, `assets`).

**In-code:**
- Action types: `SCREAMING_SNAKE_CASE` strings (`'START_WORKOUT'`, `'ADD_CUSTOM_EXERCISE'`, `'SET_WEEKDAY_ASSIGNMENT'`) dispatched from screens and matched in `reducer.js`'s `switch`.
- Hooks: camelCase prefixed with `use` (`useStore`, `useAndroidBackButton`).
- localStorage keys are namespaced with a version suffix: `'fitlog:v1'` (`src/state/storage.js:1`).

## Where to Add New Code

**New Feature (new screen/route):**
- Component: add `src/screens/<FeatureName>.jsx`.
- Register route: add a `<Route>` in `src/App.jsx`'s `<Routes>` block and update `showNavFor()` if it should show the bottom nav.
- State: add new action type(s) to `src/state/reducer.js`; if the feature needs derived stats, add a pure function to `src/lib/selectors.js` (or a new `src/lib/<feature>.js` module for self-contained domain logic, following the pattern of `schedule.js`/`muscles.js`).
- Tests: no existing test infra to extend — introducing one would require first choosing/adding a runner (none currently configured).

**New Reusable UI Component:**
- Implementation: `src/components/<ComponentName>.jsx`, kept presentational (props in, JSX out) — do not import `useStore` here; pass data down from the calling screen instead, matching existing components.

**New Domain/Business Logic:**
- Pure, stateless logic: add a module to `src/lib/` (e.g., new `.js` file exporting named functions), imported by screens and/or `reducer.js`. Avoid adding React or store imports here.

**New Persisted State Field:**
- Add the field's default to `buildInitialState()` in `src/state/StoreContext.jsx` (and add a backfill check there for users with existing persisted state, following the `weekdayAssignments`/`scheduleRestartAt` pattern at lines 12-14).
- Add corresponding action type(s) in `src/state/reducer.js` to mutate it.

## Special Directories

**`dist/`:**
- Purpose: Build artifact output from `vite build`.
- Generated: Yes.
- Committed: No (should be gitignored; verify `.gitignore` covers it).

**`android/`:**
- Purpose: Native Capacitor Android project wrapping the web build.
- Generated: Yes (scaffolded), then hand-edited for native config.
- Committed: Currently untracked per git status — decide intentionally whether to commit (native projects are typically committed for Capacitor apps to preserve manual native config).

**`.planning/`:**
- Purpose: GSD workflow artifacts (this document lives here).
- Generated: Yes (by GSD tooling).
- Committed: Per project convention, typically yes.

---

*Structure analysis: 2026-09-05*
