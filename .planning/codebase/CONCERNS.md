# Codebase Concerns

**Analysis Date:** 2026-09-05
**Last Reviewed:** 2026-09-05 (post-milestone fixes)

## Tech Debt

**~~No automated tests~~ — RESOLVED (2026-09-05):**
- Vitest + React Testing Library installed (Phase 4). `src/state/reducer.js`, `src/state/StoreContext.js`'s `buildInitialState`, `src/lib/schedule.js`, `src/lib/csvImport.js`, and `src/lib/selectors.js` all now have unit tests (`*.test.js`/`*.test.jsx` alongside each source file); `ConfirmSheet`, `RoutineBuilder`'s `BlockEditSheet`, `SessionBar`, and `ErrorBoundary` have smoke-level component tests. 55 tests across 9 files, `npm test` + `npm run lint` both exit clean.
- Not yet covered: `src/lib/insights.js`, most screen components beyond the smoke tests above, and end-to-end/integration flows (a full workout session start-to-finish, CSV import wizard end-to-end). Still a reasonable next target if this codebase's test coverage keeps expanding.

**Single-file state reducer growing large:**
- Issue: `src/state/reducer.js` (270 lines) centralizes all workout/routine/settings mutations in one switch-like reducer, alongside helper functions like `buildActiveWorkoutFromRoutine`.
- Files: `src/state/reducer.js`
- Impact: As more actions are added, this file will become a bottleneck for merge conflicts and hard-to-follow control flow.
- Fix approach: Split into per-domain reducers (routines, active workout, settings) composed together, once the file grows past ~400 lines.

**Large screen components:**
- Issue: `src/screens/RoutineBuilder.jsx` (321 lines) and `src/screens/ActiveWorkout.jsx` (303 lines) mix UI rendering, local state, and business logic in single components.
- Files: `src/screens/RoutineBuilder.jsx`, `src/screens/ActiveWorkout.jsx`, `src/screens/Home.jsx` (261 lines), `src/screens/StatsHub.jsx` (240 lines)
- Impact: Harder to test and reason about; changes to one part of the screen risk unrelated regressions.
- Fix approach: Extract sub-components (e.g., block editor, set-row editor) and move pure calculations into `src/lib/`.

**No linting for code style beyond oxlint defaults:**
- Issue: Only `oxlint` is configured (`package.json` script `"lint": "oxlint"`); no Prettier config file was found.
- Files: `package.json`
- Impact: Formatting consistency relies on manual discipline; oxlint catches correctness issues but not style/formatting drift.
- Fix approach: Add Prettier with a shared config if the team grows or formatting inconsistency becomes visible in diffs.

## Known Bugs

None identified through static review; no bug tracker or issue list found in the repo. Given the absence of tests, latent bugs are likely undetected — see Test Coverage Gaps below.

## Security Considerations

**No secrets exposure risk detected:**
- Risk: This is a fully client-side, offline-first app (localStorage only, no backend, no API keys). No `.env` files or credential files were found.
- Files: n/a
- Current mitigation: N/A — no server-side attack surface exists.
- Recommendations: If a backend/sync feature is added later (mentioned as a possibility in `docs/app-depend.md`), revisit this section for auth/token handling concerns.

**LocalStorage as sole data store:**
- Risk: All user data (workout history, routines, measurements) lives in `localStorage` under a single key (`fitlog:v1` in `src/state/storage.js`). Clearing browser data or reinstalling the Capacitor Android app wrapper will silently wipe all history with no backup/export prompt.
- Files: `src/state/storage.js`
- Current mitigation: `src/screens/ExportInsights.jsx` and `src/lib/csv.js` provide manual CSV export, but nothing is automatic.
- Recommendations: Consider periodic auto-export reminders or IndexedDB with larger storage quota as data grows; warn users before destructive actions (e.g., app uninstall, cache clear) if platform APIs allow.

## Performance Bottlenecks

**Full-state JSON serialization on every save:**
- Problem: `saveState` in `src/state/storage.js` calls `JSON.stringify(state)` on the *entire* app state on every dispatch-triggered save, with no debouncing visible in this file.
- Files: `src/state/storage.js`
- Cause: Naive whole-state persistence pattern; as workout history grows over months/years, this JSON blob will grow, making every save (each set logged, each field edited) a full-state stringify.
- Improvement path: Debounce saves during active workout data entry, or split persisted state into segments (e.g., history vs. settings) saved independently.

## Fragile Areas

**Weekday scheduling date arithmetic:**
- Files: `src/lib/schedule.js`
- Why fragile: The comments in the file itself acknowledge the complexity ("nothing skips ahead further until it's actually completed, so a missed day pushes the whole rotation forward... without any separate drift counter to keep in sync"). Calendar-day arithmetic (timezones, DST, "local ISO date" conversions) is a classic source of off-by-one-day bugs.
- Safe modification: Any change here should be paired with unit tests covering: routine due today, routine overdue by N days, routine due in the future, and rotation pointer advancing across a weekend/DST boundary.
- Test coverage: `src/lib/schedule.test.js` (added 2026-09-05) covers `nextUpSince` (restart-anchor precedence), `dueInfo` (due today / overdue / no-weekday-assignment), `dayStatus` (future/done/rest/today/missed), `weekStripDates` (Mon-Sun span, week-offset shift), and `defaultWeekdayAssignments`. DST-boundary rollover specifically is still untested — the underlying `Date` arithmetic is timezone-naive by construction (see `format.js`'s `localISODate` comment), so a DST-crossing test would mostly validate the JS `Date` object's own DST handling rather than this file's logic; low priority given that.

**CSV import pipeline:**
- Files: `src/lib/csvImport.js` (114 lines), `src/screens/CsvImport.jsx` (173 lines), `src/lib/csv.js` (71 lines)
- Why fragile: Parses arbitrary user-supplied CSV data (likely from the original StrengthLog app export) into internal state shape with no visible schema validation library — manual parsing is error-prone against malformed/edge-case input (extra columns, missing fields, locale-specific number formats).
- Safe modification: Add tests for malformed CSV rows before modifying the parser; ensure `try/catch` boundaries surface clear errors to `src/screens/CsvImport.jsx` UI rather than crashing the screen.
- Test coverage: `src/lib/csvImport.test.js` (added 2026-09-05) covers `matchExercise` (exact/alias/custom/no-match), `detectUnit` (kg/lb/no-column/no-hint), `buildCandidates` (missing-field flagging, clean rows, bad dates), and `finalizeImport` (date+exercise grouping, flagged-row exclusion, lb→kg conversion, new-exercise-name collection). `src/screens/CsvImport.jsx` (the wizard UI itself) and `src/lib/csv.js` (export formatting) remain untested.

## Scaling Limits

**localStorage size ceiling:**
- Current capacity: Browsers/WebViews typically cap `localStorage` at 5-10MB per origin.
- Limit: A long-term user (years of workout history, especially with per-set data) could eventually approach this ceiling, especially inside the Capacitor Android WebView wrapper (`android/` directory) where storage behavior can differ from desktop browsers.
- Scaling path: Migrate to IndexedDB (much larger quota) if/when this becomes a practical concern; `src/state/storage.js` is the single choke point to change.

## Dependencies at Risk

**Bleeding-edge major versions:**
- Risk: `package.json` pins React `^19.2.8`, Vite `^8.2.2`, and react-router-dom `^7.18.3` — all recent major versions with less production battle-testing than N-1 releases.
- Impact: Ecosystem plugins/tools may lag behind in compatibility; upgrade path for Vite 8 / React 19 is less trodden than older majors.
- Migration plan: No action needed proactively, but pin exact versions or add a lockfile check in CI if reproducibility issues arise (verify `package-lock.json` is committed and up to date — it currently shows as modified in git status).

## Missing Critical Features

**~~No error boundary / crash reporting~~ — PARTIALLY RESOLVED (2026-09-05):**
- `src/components/ErrorBoundary.jsx` now wraps the route tree in `App.jsx` (keyed by pathname, resets on navigation), so an unhandled exception in one screen no longer white-screens the whole app — BottomNav, SessionBar, and Android back-button handling stay alive, and the user gets a "Try again" fallback. 3 passing tests in `ErrorBoundary.test.jsx`.
- Still open: no crash/error-tracking integration (e.g. Sentry) — errors are only logged to `console.error`. Deliberately not added: this is a fully offline, single-user, local-only app with no backend, so a third-party crash-reporting SDK would be a new external dependency disproportionate to the actual risk. Revisit if the app ever gains a backend/sync feature.

**No data corruption recovery:**
- Problem: `loadState` in `src/state/storage.js` returns `null` on any parse failure, silently discarding the corrupted blob rather than attempting partial recovery or notifying the user before overwriting it on next save.
- Blocks: A user with corrupted localStorage (e.g., from a botched app update) loses all data with no warning and no backup prompt.

## Test Coverage Gaps

**~~Entire application~~ — PARTIALLY RESOLVED (2026-09-05):**
- Now tested: `src/state/reducer.js`, `src/state/StoreContext.jsx` (`buildInitialState`), `src/lib/schedule.js`, `src/lib/csvImport.js`, `src/lib/selectors.js` (`bestProductForExercise`, `totalVolume`/`totalReps`/`totalSets`, `muscleSetCounts`, `exerciseSetCounts`), plus component smoke tests for `ConfirmSheet` (hold gesture), `RoutineBuilder`'s `BlockEditSheet` (target-weight field) and drag gesture, `SessionBar`, and `ErrorBoundary`. 55 tests across 9 files.
- Still not tested: `src/lib/insights.js`, `src/lib/csv.js` (export formatting), `src/lib/rng.js`, most screen components beyond the smoke tests listed above (full-flow rendering of `ActiveWorkout`, `RoutineBuilder`, `CsvImport`, `StatsHub`, etc.), and any end-to-end/integration flow (a full workout session start-to-finish, the CSV import wizard end-to-end).
- Priority: Medium going forward — the highest-risk, most-fragile logic (scheduling math, CSV parsing, reducer transitions, PR/volume calculations) now has a safety net; remaining gaps are lower-severity (formatting/export helpers) or higher-cost-to-test (full component/integration flows) and can be picked up incrementally rather than as a single push.

---

*Concerns audit: 2026-09-05*
