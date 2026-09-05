# Phase 1: Fresh Install & Safe Deletion - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 7 (2 deleted, 2 modified with new behavior, 3 verify-unaffected)
**Analogs found:** 5 / 5 (analogs are internal — this phase mostly modifies existing files in place, so each file's own current content is its own best "before" reference; `ProgressBar.jsx` is the external reused pattern)

## File Classification

| New/Modified/Deleted File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/ConfirmSheet.jsx` | component (modal) | request-response (user gesture → confirm/cancel callback) | `src/components/ProgressBar.jsx` (for the fill mechanic only) | role-match (fill mechanic), exact (component itself, modified in place) |
| `src/state/StoreContext.jsx` (`buildInitialState`) | provider / state init | CRUD (initial state construction) | itself, current lines 9-26 | exact (in-place edit) |
| `src/lib/seed.js` | utility (demo-data generator) | batch/transform | n/a — deleted entirely | deletion, no analog needed |
| `src/lib/rng.js` | utility (PRNG) | transform | n/a — deleted entirely | deletion, no analog needed |
| `src/state/reducer.js` (`DELETE_ALL_DATA`) | reducer case | CRUD | itself, lines 252-261 | exact — read-only reference, not modified |
| `src/screens/Settings.jsx` (ConfirmSheet call site) | screen | request-response | itself, lines 91-99 | exact (in-place edit: add `holdToConfirm`) |
| `src/screens/Routines.jsx` / `src/screens/ActiveWorkout.jsx` (ConfirmSheet call sites) | screen | request-response | `src/screens/Settings.jsx` current call site (pre-edit) | exact — must remain byte-identical in behavior, verify only |

## Pattern Assignments

### `src/components/ConfirmSheet.jsx` (component, request-response)

**Current full content** (`src/components/ConfirmSheet.jsx:1-31`) is the baseline to extend, not replace:

```jsx
export default function ConfirmSheet({ open, title, body, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        className="fade-in mx-auto w-full max-w-[480px] rounded-t-[24px] p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
        style={{ background: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-serif text-lg font-semibold">{title}</div>
        {body && <div className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{body}</div>}
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-2xl border py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white"
            style={{ background: danger ? 'var(--danger)' : 'var(--accent)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Required change (per D-08, CONTEXT.md and UI-SPEC.md):** add an opt-in `holdToConfirm` prop (default `false`/undefined) that only changes the confirm `<button>`'s markup/behavior when true. The Cancel button, sheet chrome, and non-`holdToConfirm` confirm button must stay byte-identical to the excerpt above — this is what keeps `Routines.jsx` and `ActiveWorkout.jsx` pixel-identical (UI-SPEC "Reusability constraint").

**Fill-overlay mechanic to copy from `ProgressBar.jsx`** (`src/components/ProgressBar.jsx:1-10`, full file):

```jsx
export default function ProgressBar({ pct, height = 8, color = 'var(--accent)', track = 'var(--surface-alt)' }) {
  return (
    <div className="overflow-hidden rounded-full" style={{ height, background: track }}>
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  )
}
```

Copy the "outer `overflow-hidden` container + inner div with `width: {pct}%` via `transition-[width]`" structure exactly — this is the locked mechanism per UI-SPEC.md ("Mechanism: linear width-fill overlay"). Do NOT introduce `requestAnimationFrame`, conic-gradient, or a new progress-ring component.

**Concretely, when `holdToConfirm` is true, the confirm button becomes** (per UI-SPEC.md lines 95-122 — this is locked spec, not discretionary):

```jsx
<button
  onPointerDown={startHold}
  onPointerUp={cancelHold}
  onPointerLeave={cancelHold}
  onPointerCancel={cancelHold}
  onContextMenu={(e) => e.preventDefault()}
  className="relative flex-1 overflow-hidden rounded-2xl py-3 text-sm font-semibold text-white"
  style={{ background: 'var(--danger)', touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
>
  <div
    className="absolute inset-y-0 left-0 pointer-events-none"
    style={{
      width: `${holdPct}%`,
      background: 'rgba(255,255,255,0.25)',
      transition: holding ? 'width 1500ms linear' : 'width 150ms ease-out',
    }}
  />
  <span className="relative z-10">{confirmLabel}</span>
</button>
```

- `startHold` (on `onPointerDown`): sets `holding=true`, `holdPct=100` (letting CSS transition drive the visual fill over 1500ms), and starts a `setTimeout(1500)` that calls `onConfirm()`.
- `cancelHold` (on `onPointerUp`/`onPointerLeave`/`onPointerCancel`): clears the timeout, sets `holding=false`, `holdPct=0` — the 150ms ease-out transition kicks in because `holding` flips before the width changes.
- The plain (non-hold) button variant must keep `onClick={onConfirm}` exactly as today — do not attach pointer handlers when `holdToConfirm` is falsy.
- No `onClick` on the hold-variant button (per UI-SPEC.md: "must NOT independently fire `onConfirm`... Only the 1500ms timeout may call `onConfirm`").

---

### `src/state/StoreContext.jsx` — `buildInitialState()` (provider, CRUD)

**Current pattern to modify** (`src/state/StoreContext.jsx:1-26`):

```jsx
import { reducer, initialSettings, allExercises } from './reducer'
import { loadState, saveState } from './storage'
import { buildSeed } from '../lib/seed'
import { defaultWeekdayAssignments } from '../lib/schedule'

function buildInitialState() {
  const persisted = loadState()
  if (persisted) {
    if (!persisted.weekdayAssignments) persisted.weekdayAssignments = defaultWeekdayAssignments(persisted.routineOrder)
    if (persisted.scheduleRestartAt === undefined) persisted.scheduleRestartAt = null
    return persisted
  }
  return {
    settings: initialSettings(),
    user: { name: 'Marcus' },
    customExercises: [],
    exerciseNotes: {},
    importPresets: [],
    lastFinishedSession: null,
    ...buildSeed(),
  }
}
```

**Required change:** remove the `import { buildSeed } from '../lib/seed'` line entirely, and replace `...buildSeed()` in the `else` branch's returned object with explicit empty-state fields matching what `buildSeed()` used to spread in (per D-01, and the field list `buildSeed()` returns at `src/lib/seed.js:226-244`: `routines`, `routineOrder`, `sequenceIndex`, `routineMode`, `weekdayAssignments`, `scheduleRestartAt`, `sessions`, `measurements`, `goals`, `activeWorkout`, `lastImportedAt`, `createdAt`). Keep `defaultWeekdayAssignments([])` for `weekdayAssignments` (already imported, used identically to how the persisted-branch backfill uses it on line 13) — this satisfies discretion point in CONTEXT.md D-08's sibling note.

The `if (persisted)` branch (lines 11-16) is untouched — it already only runs `buildSeed()` in the `else` branch, so DATA-02 (never overwrite real data) is structurally already satisfied; this is purely an edit to what the `else` branch constructs.

---

### `src/lib/seed.js` and `src/lib/rng.js` — deletion targets

No pattern extraction needed; per D-02 these files are deleted outright, not modified or gated. Before deleting, confirm no other importers exist:

```bash
grep -rn "from '../lib/seed'\|from './lib/seed'\|from '../lib/rng'\|from './lib/rng'" src/
```

Only known importer of `seed.js` is `src/state/StoreContext.jsx` (line 4, removed above). Only known importer of `rng.js` is `src/lib/seed.js` itself (`import { mulberry32 } from './rng'` — `src/lib/seed.js:1`), which is also being deleted, so no dangling references remain once both are removed together.

---

### `src/state/reducer.js` — `DELETE_ALL_DATA` (reference only, not modified)

**Current pattern** (`src/state/reducer.js:252-261`):

```js
case 'DELETE_ALL_DATA':
  return {
    ...state,
    sessions: [],
    measurements: [],
    activeWorkout: null,
    goals: [],
    customExercises: [],
    exerciseNotes: {},
  }
```

This case is already correctly scoped (deliberately keeps `routines`/`routineOrder`, matching the ConfirmSheet body copy "Routines and the exercise library are kept"). Nothing here changes in this phase — it's provided as read-only context for whoever wires the hold-to-confirm `onConfirm` callback in `Settings.jsx`.

---

### `src/screens/Settings.jsx` — ConfirmSheet call site (screen, request-response)

**Current pattern** (`src/screens/Settings.jsx:91-99`):

```jsx
<ConfirmSheet
  open={confirmDelete}
  title="Delete all data?"
  body="This permanently removes every workout, measurement, and goal on this device. Routines and the exercise library are kept."
  confirmLabel="Delete everything"
  danger
  onCancel={() => setConfirmDelete(false)}
  onConfirm={() => { dispatch({ type: 'DELETE_ALL_DATA' }); setConfirmDelete(false) }}
/>
```

**Required change:** add `holdToConfirm` prop (boolean `true`, or a duration override object per D-08's "optional duration override" — simplest is `holdToConfirm` boolean since duration is locked at 1500ms per UI-SPEC and not exposed as a per-call-site override requirement). All other props (`title`, `body`, `confirmLabel`, `danger`, `onCancel`, `onConfirm`) stay unchanged — the `onConfirm` callback body is unaffected; only the trigger timing changes (tap → 1500ms hold), which is entirely internal to `ConfirmSheet`.

---

### `src/screens/Routines.jsx` and `src/screens/ActiveWorkout.jsx` — verify unaffected

**Routines.jsx** (`src/screens/Routines.jsx:126-134`) and **ActiveWorkout.jsx** (`src/screens/ActiveWorkout.jsx:224-231`) both call `<ConfirmSheet ... />` without a `holdToConfirm` prop. Per the default (`holdToConfirm` falsy), `ConfirmSheet` must render these two call sites pixel-identical to today — plain `onClick={onConfirm}` button, no `relative overflow-hidden` wrapper, no fill layer, no pointer-event wiring. No code changes needed in these two screen files; this is a verification-only item (confirm no regressions after `ConfirmSheet.jsx` is edited).

## Shared Patterns

### CSS custom properties for color (not Tailwind color classes)
**Source:** `src/components/ConfirmSheet.jsx` (`style={{ background: danger ? 'var(--danger)' : 'var(--accent)' }}`), `src/components/ProgressBar.jsx` (`color = 'var(--accent)'`)
**Apply to:** the new fill-overlay layer — its color is `rgba(255,255,255,0.25)` per UI-SPEC.md (a fixed value, not a new CSS custom property), applied via inline `style`, consistent with how `--danger`/`--accent` are already applied via `style` rather than Tailwind utility classes throughout this codebase.

### Pointer Events over separate touch/mouse handlers
**Source:** no existing analog in codebase (confirmed via CONTEXT.md: "no shared 'long press' hook... currently exists") — this is genuinely new interaction wiring, per UI-SPEC.md section "Trigger wiring." Use `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` as specified; do not search for or reuse the existing "long-press" pattern mentioned in `docs/app.md` (goal/set edit menus) — CONTEXT.md explicitly flags that as a different, unrelated mechanic.

### Reducer guard style (defensive, no-op on invalid state)
**Source:** `src/state/reducer.js` general convention (e.g. `if (!state.activeWorkout) return state` pattern elsewhere in the file) — not directly needed here since `DELETE_ALL_DATA` is unconditional and unmodified, but relevant if any edge case is discovered during implementation (e.g., double-fire protection is handled at the `ConfirmSheet` component level via the timeout/pointer wiring, not in the reducer).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Hold-to-fill pointer/timeout wiring inside `ConfirmSheet.jsx` | component interaction logic | event-driven | No prior press-and-hold-with-visual-fill gesture exists in this codebase; UI-SPEC.md fully specifies the contract in lieu of a codebase analog (see "Interaction & Animation Contract" section, already excerpted above) |

## Metadata

**Analog search scope:** `src/components/`, `src/state/`, `src/screens/`, `src/lib/`
**Files scanned:** `ConfirmSheet.jsx`, `ProgressBar.jsx`, `StoreContext.jsx`, `reducer.js`, `seed.js`, `rng.js`, `Settings.jsx`, `Routines.jsx`, `ActiveWorkout.jsx`
**Pattern extraction date:** 2026-09-05
