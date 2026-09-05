# Testing Patterns

**Analysis Date:** 2026-09-05

## Test Framework

**Runner:**
- None configured. No Jest, Vitest, Mocha, or Playwright dependency exists in `package.json`.
- No test config files present (`vitest.config.*`, `jest.config.*` all absent).

**Assertion Library:**
- Not applicable — no framework installed.

**Run Commands:**
```bash
# No test script exists in package.json.
# Available scripts today:
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run lint      # oxlint static analysis
npm run preview   # Preview production build
```

## Test File Organization

**Location:**
- Not applicable. No `*.test.*` or `*.spec.*` files exist anywhere in the repository (verified via full-repo search).

**Naming:**
- No convention established yet.

**Structure:**
```
No test directories or co-located test files present.
```

## Test Structure

Not applicable — no tests exist to derive patterns from.

## Mocking

Not applicable — no mocking library or usage present.

## Fixtures and Factories

**Test Data:**
- No formal fixtures exist, but `src/lib/seed.js` builds realistic demo/seed data used to initialize state on first run (`buildSeed()`, consumed in `src/state/StoreContext.jsx`). This is the closest analog to a fixture generator and could be reused as a basis for test fixtures if a test suite is introduced.
- `src/lib/rng.js` provides a seedable random number generator, likely used by `seed.js` to produce deterministic demo data — also reusable for deterministic test data generation.

**Location:**
- `src/lib/seed.js`, `src/lib/rng.js`

## Coverage

**Requirements:** None enforced — no coverage tooling installed.

**View Coverage:**
```bash
# Not applicable — no coverage tooling configured.
```

## Test Types

**Unit Tests:** None present. Best candidates for future unit tests are the pure functions in `src/lib/` (`format.js`, `selectors.js`, `schedule.js`, `insights.js`, `csv.js`, `csvImport.js`) and the `reducer.js` state transitions in `src/state/`, since these contain the app's core logic and have no side effects beyond simple object transforms.

**Integration Tests:** None present. `src/state/reducer.js` combined with `src/state/StoreContext.jsx` (dispatch + persistence + theme side effects) would be the natural integration test boundary.

**E2E Tests:** Not used. No Playwright/Cypress config or dependency.

## Common Patterns

Not applicable — no existing test code to reference for async or error-testing patterns.

## Recommendations for Introducing Tests

- Add `vitest` (pairs naturally with the existing Vite build, requires minimal config) plus `@testing-library/react` for component tests.
- Start with pure `src/lib/*.js` functions — they take primitive/plain-object inputs and return primitive/plain-object outputs, requiring no mocking.
- Next, test `src/state/reducer.js` directly: call `reducer(state, action)` with hand-built state fixtures and assert on the returned state shape (no React rendering needed).
- Mock `localStorage` only when testing `src/state/storage.js` or `StoreContext.jsx` initialization/backfill logic (`buildInitialState`).
- Defer component/UI tests until logic coverage exists, since screens in `src/screens/` mix state access, layout, and navigation (`react-router-dom`) and require more setup (Router + Store providers).

---

*Testing analysis: 2026-09-05*
