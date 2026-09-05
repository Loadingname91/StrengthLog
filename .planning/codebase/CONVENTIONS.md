# Coding Conventions

**Analysis Date:** 2026-09-05

## Naming Patterns

**Files:**
- React components: PascalCase `.jsx` (e.g. `src/components/Card.jsx`, `src/screens/ActiveWorkout.jsx`)
- Non-component modules: camelCase `.js` (e.g. `src/lib/format.js`, `src/lib/selectors.js`, `src/state/reducer.js`)
- Screens live in `src/screens/`, reusable UI in `src/components/`, framework-free logic in `src/lib/`, global state in `src/state/`

**Functions:**
- camelCase, verb-first for actions/helpers: `buildActiveWorkoutFromRoutine`, `isLastInPair`, `bestProductForExercise`
- `fmt`-prefixed formatters: `fmtDate`, `fmtDateLong`, `fmtElapsed`, `fmtClock` (`src/lib/format.js`)
- Boolean-returning helpers read as predicates: `isLastInPair`, `isPR`

**Variables:**
- camelCase throughout; short loop/local names (`d`, `s`, `m`, `r`) acceptable in small formatting helpers, descriptive names elsewhere (`weekdayAssignments`, `restExerciseIndex`)
- No Hungarian notation or type prefixes

**Types:**
- No TypeScript; plain JS objects act as implicit shapes (e.g. workout `state`, `session`, `set`). `@types/react` and `@types/react-dom` are present only for editor intellisense, not enforced typing.

## Code Style

**Formatting:**
- No Prettier config detected. Style is consistently: no semicolons, single quotes, 2-space indentation (see any file in `src/`)
- Template literals used for string interpolation (`` `${y}-${m}-${day}` ``)

**Linting:**
- `oxlint` via `npm run lint`, config at `.oxlintrc.json`
- Enabled plugins: `react`, `oxc`
- Rules: `react/rules-of-hooks: error`, `react/only-export-components: warn` (with `allowConstantExport: true`)
- No other custom rules configured — relies on oxlint defaults otherwise

## Import Organization

**Order:**
1. External packages (`react`, `react-dom`, `react-router-dom`)
2. Local modules via relative paths, roughly grouped by originating concern (state, then lib, then components) — see `src/state/StoreContext.jsx` importing `./reducer`, `./storage`, then `../lib/seed`, `../lib/schedule`

**Path Aliases:**
- None configured. All internal imports use relative paths (`../lib/format`, `./reducer`)

## Error Handling

**Patterns:**
- Defensive `try/catch` around localStorage I/O with silent fallback: `loadState`/`saveState` in `src/state/storage.js` catch and return `null` / no-op, with an inline comment explaining why swallowing is safe
- Reducer actions guard against invalid state instead of throwing: e.g. `if (!state.activeWorkout) return state` (`src/state/reducer.js`)
- Context misuse throws explicit errors: `useStore()` throws `Error('useStore must be used within StoreProvider')` (`src/state/StoreContext.jsx`)
- Numeric parsing guarded with `Number.isFinite` checks before use (`src/state/reducer.js` `TOGGLE_SET_DONE` case)

## Logging

**Framework:** None — no `console.*` calls found in `src/`. Errors are handled via silent fallback or thrown `Error` objects, not logged.

## Comments

**When to Comment:**
- Sparse; reserved for non-obvious correctness reasoning, e.g. the multi-line comment in `src/lib/format.js` explaining why `localISODate` avoids `toISOString()` (timezone bug), and the storage.js comment on silent catch
- No comments for straightforward code

**JSDoc/TSDoc:**
- Not used. No function has JSDoc annotations.

## Function Design

**Size:** Small, single-purpose functions (most under 20 lines). Reducer `case` blocks are the largest units and stay scoped to one state transition, using block-scoped `{ }` for local variables when needed.

**Parameters:** Plain positional args for lib functions (`blockTarget(block)`, `daysAgo(n)`); reducer actions use a single `action` object with `{ type, payload }` shape (Flux/Redux convention) despite using plain `useReducer`, not Redux.

**Return Values:** Reducer cases always return a new state object via spread (`{ ...state, ... }`), never mutate. Selectors/lib functions return primitives or plain objects/arrays.

## Module Design

**Exports:** Named exports (`export function ...`) throughout `src/lib/` and `src/state/`; components in `src/components/` and `src/screens/` use `export default function ComponentName(...)`.

**Barrel Files:** None. Every module is imported directly from its file path.

## State Management

- Global app state lives in a single `useReducer` (`src/state/reducer.js`) exposed via React Context (`src/state/StoreContext.jsx`)
- Access pattern: `const { state, dispatch, exercises } = useStore()` — never import the context directly
- Persistence: whole state object serialized to `localStorage` on every change via `useEffect` in `StoreContext.jsx`, keyed by `fitlog:v1` in `src/state/storage.js`
- Backward compatibility for persisted state handled by explicit backfill checks in `buildInitialState()` (`src/state/StoreContext.jsx`), e.g. `if (!persisted.weekdayAssignments) persisted.weekdayAssignments = ...`
- All state mutations go through dispatched actions with `{ type: 'ACTION_NAME', payload }`; action type constants are inline strings, not an enum/constants file

## Styling

- Tailwind CSS v4 utility classes used inline in JSX `className` (see `src/components/Card.jsx`)
- Theme values (colors) come from CSS custom properties (`var(--surface)`, `var(--border)`) applied via inline `style` objects, not Tailwind classes, allowing light/dark theme switching via `data-theme` attribute on `<html>` (set in `StoreContext.jsx`)
- Components accept `className` and `style` props for caller-side overrides, merged with sensible defaults

---

*Convention analysis: 2026-09-05*
