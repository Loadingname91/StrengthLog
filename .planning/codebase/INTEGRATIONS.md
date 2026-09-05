# External Integrations

**Analysis Date:** 2026-09-05

## APIs & External Services

**None detected.**
- No HTTP client (fetch wrapper, axios), no third-party SDK imports (e.g., Stripe, Supabase, Firebase, AWS) found anywhere in `src/`.
- This is a fully offline, client-side workout tracker app with no backend API calls.

## Data Storage

**Databases:**
- None. No SQL/NoSQL database or ORM client in dependencies.

**Local Persistence:**
- Browser `localStorage` is the sole persistence mechanism.
  - Implementation: `src/state/storage.js`
  - Key: `fitlog:v1`
  - `loadState()` reads and JSON-parses the stored state, returning `null` on missing/invalid data.
  - `saveState(state)` JSON-stringifies and writes to `localStorage`, silently no-oping on failure (e.g., quota exceeded or storage unavailable) — state remains in-memory for that session only.

**File Storage:**
- Local filesystem only (no cloud file storage). Static assets served from `public/` and `src/assets`.

**Caching:**
- None (no separate caching layer beyond the browser's own `localStorage`/asset caching).

## Authentication & Identity

**Auth Provider:**
- None. No login/auth screens, tokens, or session management detected — the app is single-user, local-only, with no identity system.

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Bugsnag or similar SDK detected).

**Logs:**
- None beyond standard `console` usage, if any (no dedicated logging library in dependencies).

## CI/CD & Deployment

**Hosting:**
- Not configured in-repo. Build output (`dist/`) is a static SPA that could be deployed to any static host, but no deployment config (Vercel/Netlify/GitHub Pages workflow) is present.

**CI Pipeline:**
- None detected. No `.github/workflows/`, no CI config files found.

**Native App Packaging:**
- Capacitor CLI (`@capacitor/cli`) is used to wrap the Vite build (`dist/`) into a native Android project under `android/` (Gradle-based). This is a build/packaging tool, not a network integration.

## Environment Configuration

**Required env vars:**
- None. No `.env` files or `import.meta.env.*` usage patterns for external config detected.

**Secrets location:**
- Not applicable — no secrets or credentials are used by the app.

## Webhooks & Callbacks

**Incoming:**
- None (no server, so no webhook endpoints).

**Outgoing:**
- None — no outbound network calls to third-party services found in the codebase.

## Native Platform Integration

**Capacitor Bridge (`src/App.jsx`):**
- `Capacitor.isNativePlatform()` gates native-only behavior.
- `@capacitor/app`'s `CapacitorApp.addListener('backButton', ...)` handles the Android hardware back button, calling `CapacitorApp.exitApp()` when appropriate. This is the only native-bridge integration in the app; it does not involve any external service.

---

*Integration audit: 2026-09-05*
