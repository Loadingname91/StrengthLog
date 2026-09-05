# Codebase Concerns

**Analysis Date:** 2026-09-05

## Tech Debt

**No automated tests:**
- Issue: No test framework is configured (no Jest/Vitest, no `*.test.*` files found anywhere in the repo).
- Files: entire `src/` tree, especially complex logic in `src/lib/schedule.js`, `src/state/reducer.js`, `src/lib/selectors.js`, `src/lib/csvImport.js`
- Impact: Regressions in scheduling math, PR/insight calculations, and reducer state transitions can ship silently. The Weekday-mode scheduling logic (`src/lib/schedule.js`) has intricate date-rollover rules that are exactly the kind of code that breaks under refactor without tests.
- Fix approach: Add Vitest + React Testing Library; prioritize unit tests for `src/lib/schedule.js`, `src/state/reducer.js`, and `src/lib/csvImport.js` first since they contain the most business logic and no UI dependency.

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
- Test coverage: None currently exists.

**CSV import pipeline:**
- Files: `src/lib/csvImport.js` (114 lines), `src/screens/CsvImport.jsx` (173 lines), `src/lib/csv.js` (71 lines)
- Why fragile: Parses arbitrary user-supplied CSV data (likely from the original StrengthLog app export) into internal state shape with no visible schema validation library — manual parsing is error-prone against malformed/edge-case input (extra columns, missing fields, locale-specific number formats).
- Safe modification: Add tests for malformed CSV rows before modifying the parser; ensure `try/catch` boundaries surface clear errors to `src/screens/CsvImport.jsx` UI rather than crashing the screen.
- Test coverage: None.

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

**No error boundary / crash reporting:**
- Problem: No React error boundary component or crash/error-tracking integration (e.g., Sentry) was found anywhere in `src/`.
- Blocks: A single unhandled exception in any screen (e.g., a malformed CSV import or a corrupted localStorage blob) can white-screen the entire app with no diagnostic signal reaching the developer and no graceful fallback for the user.

**No data corruption recovery:**
- Problem: `loadState` in `src/state/storage.js` returns `null` on any parse failure, silently discarding the corrupted blob rather than attempting partial recovery or notifying the user before overwriting it on next save.
- Blocks: A user with corrupted localStorage (e.g., from a botched app update) loses all data with no warning and no backup prompt.

## Test Coverage Gaps

**Entire application:**
- What's not tested: 100% of the codebase — there are zero test files in the repository.
- Files: all of `src/`
- Risk: Any refactor (state shape changes, scheduling logic, CSV parsing, PR/insight calculations in `src/lib/selectors.js` and `src/lib/insights.js`) has no safety net.
- Priority: High — start with `src/lib/schedule.js`, `src/state/reducer.js`, `src/lib/csvImport.js`, and `src/lib/selectors.js` since they hold the most business-critical logic and are pure-ish (easiest to unit test without heavy mocking).

---

*Concerns audit: 2026-09-05*
