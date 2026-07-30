# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SERVIX is a self-hosted panel for tracking servers, domains, certificates, hosting providers, payments and expiration dates, with Telegram notifications. Single Node.js backend (no framework — see below) + React/Next.js SPA frontend, SQLite storage.

## Commands

```bash
npm install         # install backend deps (there are none — see below); use `npm run build` for the frontend
npm run dev          # Next.js dev server on :5173 (frontend only, proxies /api to :3000)
npm run server       # backend on :3000, loads .env if present (alias: npm start)
npm run build         # installs web/'s deps + Next static export -> dist/
```

To develop locally you run **both** `npm run server` and `npm run dev` at the same time (two terminals) — the backend serves the API on :3000, the Next.js dev server proxies `/api/*` to it (see `web/next.config.js`'s `rewrites()`, dev-only) and serves the SPA with Fast Refresh on :5173.

There is no test suite, no lint script, and no TypeScript in this repo — don't invent `npm test`/`npm run lint` commands. The frontend is plain `.jsx`, matching that convention deliberately (not an oversight).

Production runs `npm run build` then `node server.js`, which serves the built SPA from `dist/` and the API from the same Node process/port (see Dockerfile: multi-stage build, final image only ships `server.js`, `locale/`, and `dist/`).

### Local demo/verification instance

Never point a dev server at the real `./data` directory when just testing a UI change. `npm run dev:server` runs the backend against an isolated, gitignored `./.devdata` `DATA_DIR` and sets `SEED_DEMO_DATA=true`, which seeds a handful of realistic providers/assets/payments (mixed types, categories, currencies, expiry states — overdue/due-soon/future, one inactive) the first time that DB is created; it's a no-op once the DB already has any providers/assets, so it's safe to leave set across restarts. You still need to create a demo user once via `POST /api/auth/setup` (`{"login":"demo","password":"...","passwordRepeat":"..."}`) — seeding covers business data, not auth.

For a one-off scratch instance instead (e.g. testing against an empty panel), point `DATA_DIR` at any other folder without `SEED_DEMO_DATA`:

```bash
DATA_DIR=/path/to/scratch/data node --env-file-if-exists=.env server.js
```

### Configuration

First-run config (`SITE_TITLE`, `APP_TIMEZONE`, `TELEGRAM_NOTIFY_URL`, `NOTIFY_ON_START`) is seeded from env vars but then persisted in the DB and edited from the Settings page — env vars only matter before the first row exists. `DATA_DIR` (default `./data`) and `COOKIE_SECURE` (set `true` behind an HTTPS reverse proxy) are the only env vars that matter on every run. Only one process should ever open the SQLite file at `DATA_DIR/servix.sqlite`.

## Architecture

### Backend: one file, no framework

`server.js` (~1400 lines) is the entire backend: raw `node:http` server, `node:sqlite` (`DatabaseSync`, requires Node 24+) for storage, hand-rolled session auth with TOTP 2FA, Telegram notifications, and a JSON REST API. There's no router library — `handleApi(req, res, url)` is one long chain of `if (req.method === "X" && url.pathname === "/api/y")` checks. `serveStatic` serves `dist/` — first as a literal file, then (since Next's static export lays each route out as `<route>/index.html`) tries `<path>/index.html`, then falls back to the root SPA shell for anything else — and the request handler at the bottom dispatches on `url.pathname.startsWith("/api/")`. `server.js` has **zero npm dependencies** — root `package.json` exists only so `server.js` can read its own version out of it at startup.

Key endpoint: `GET /api/assets` returns everything the frontend needs in one shot — `{ meta, providers, assets }`, where each asset has its `payments` array embedded (joined server-side in `getData()`). Most other endpoints are `POST/PUT/DELETE /api/providers[/:id]` and `/api/assets[/:id]`, following the same normalize-then-upsert pattern (`normalizeAsset`/`normalizeProvider` + `upsertAsset`/`upsertProvider`).

Notifications are scheduled with real `setTimeout`s computed from the next due event (`scheduleNotifications`/`processDueNotifications`), not a polling loop — when an asset's `expiresAt` changes, the timer is recomputed.

Records have a `type`: `vps` (= "servers" everywhere in the UI/naming), `domain`, or `certificate`. `vps`-type assets additionally carry a `category`: `infra`, `node`, or `test` (the `CATEGORIES` const) — this category concept does not apply to domains/certificates.

The CSP in `securityHeaders()` allows `'unsafe-inline'` for `script-src` — required because Next's App Router bootstraps hydration via inline `<script>self.__next_f.push(...)</script>` tags in every static export, which a per-request nonce can't cover without a real server. Don't tighten this back to `'self'`-only without switching the frontend off App Router.

### Frontend: `web/`, Next.js App Router, one context per concern

`web/` is a self-contained Next.js 16 / React 19 app (its own `package.json`, `node_modules`) that imports `locale/*.json` from the repo root (`web/lib/i18n.js` does `../../locale/*.json`) — that's why `web/next.config.js` sets `turbopack.root` one level up from `web/`, and why the Dockerfile copies `web/` and `locale/` as siblings into the build stage. It replaces the old single-file Vue `App.vue` "god object" with real per-route pages under `web/app/(dashboard)/*/page.jsx` (one per nav item: `/`, `/providers`, `/stats`, `/pnl`, `/alerts`, `/logs`, `/guide`, `/settings`) plus `web/app/login/page.jsx` for the setup/login/2FA flow — routing, auth-gating (`web/app/(dashboard)/layout.jsx`), and browser back/forward are all just Next's own router now, not hand-rolled.

State that used to live on the Vue root instance is split into React Context providers nested in `web/app/layout.jsx` (`LocaleProvider` → `ToastProvider` → `AuthProvider` → `DataProvider` → `ConfirmProvider`): `AuthContext` owns the boot/login/2FA sequence and `meta`; `DataContext` owns `assets`/`providers`/`alerts`/`security`/`update` plus the raw CRUD primitives (each one reloads after mutating, same invariant the old `await this.load()` had at every call site). Business actions that used to be plain methods on `this` (confirm dialogs, toasts, i18n messages) are now composed in `web/lib/assetActions.js` (`useAssetActions()`) and `web/lib/updateActions.js` (`useUpdateActions()`) — hooks that pull from `useData()`/`useToast()`/`useConfirm()`/`useLocale()` together, so a component just calls e.g. `saveAsset(draft)` without wiring the confirm/toast/reload sequence itself. Ephemeral per-page UI state (search text, table sort/page, which modal is open) is **not** centralized — each page/modal owns it locally, since real routes unmount on navigation now (the old `v-show`-everything-mounted trick that kept that state alive across nav is gone; revisiting a page resets its filters, which is standard behavior for real routes and hasn't been treated as a regression to fix).

Styling is one global stylesheet, `web/app/globals.css` (Tailwind v4, CSS-first config via `@theme` — no `tailwind.config.js`), imported once in the root layout. It carries the ported design tokens (`--color-bg`/`--color-accent`/GT Eesti fonts/`.glass` surfaces — originally from a separate marketing site's design system, not this codebase) plus dashboard-specific component classes authored fresh for this app (`.stat-card-sub`, `.category-badge`/`.category-group`, `.asset-type-head`, `.provider-card`, etc. — same names/conventions as the old `src/styles.css`, rebuilt, not copy-pasted). Components don't use CSS modules or styled-jsx; new UI reuses these existing classes.

UI primitives come from the unified `radix-ui` npm package, wrapped in `web/components/ui/` (`AppSelect`/`AppSelectItem`, `Modal`, `AppTooltip`, `Accordion`) — reuse these wrappers instead of importing `radix-ui` primitives directly in pages. Note: Radix's `Select.Item` cannot take an empty-string `value`; `AppSelect`/`AppSelectItem` internally remap `""` to a sentinel (`web/lib/selectEmptyValue.js`) so consumers can keep using `""` to mean "no selection". `Modal.jsx` is the single dialog component used everywhere (asset/provider forms, payments, confirm dialogs, etc.) — changes to `.dialog-head`/`.dialog-actions` styling affect every modal in the app, not just one. Framer Motion drives the modal/toast enter-exit animations; the accordion instead uses Radix's own `--radix-accordion-content-height` CSS-var approach (cheaper than a JS-measured height animation for something that toggles as often as category groups do).

### i18n

`locale/ru.json` and `locale/en.json` (repo root, shared by both the frontend and the backend) hold UI strings (`ru` is the primary/default locale). `web/lib/i18n.js` has the `translate`/`translatePlural`/`getPath`/`interpolate`/`pluralIndex` functions (ported verbatim from the old `App.vue` module-level helpers — framework-agnostic already), bound to React via `LocaleContext`'s `useLocale()` hook (`t`/`tc`/`tList`). `tc` handles Russian 3-form pluralization (`plural.<key>: [one, few, many]`) via `pluralIndex`. The backend (`server.js`) has its own separate, much smaller copy of the same `t`/`tc`/`loadLocales` pattern for building Telegram notification text — the two are not shared code, so a new user-facing string used in both places needs to be added twice.

### Versioning and self-update

The single source of truth for the version is `package.json` — `server.js` reads it at
startup (`APP_VERSION`) and returns it in `meta.version`, and the release workflow refuses
to publish a tag that disagrees with it. A release is a `vX.Y.Z` tag; `.github/workflows/release.yml`
builds and pushes `ghcr.io/<repo>:latest` and `:vX.Y.Z`. Note the entries in `CHANGELOG.md`.

`GET /api/update` reports current vs latest version (GitHub releases, falling back to tags),
`POST /api/update/check` forces a re-check, `POST /api/update/apply` starts the update and
returns 202. Two things there are deliberate: the container never recreates itself (the
Docker daemon would kill the process mid-update, leaving the panel down), so a one-shot
watchtower container launched through the docker socket does it; and the socket is spoken to
directly over the Engine API with `node:http` `socketPath`, so the image needs no docker CLI.
Without a mounted socket `canApply` is false and the UI only reports versions — that must
stay a graceful downgrade, not an error.

### Money/currency

Three currencies exist: `USDT`, `EUR`, `RUB`. `EUR` is the backend's internal pivot: `convertAmount`/`convertToEur` (`web/lib/money.js`, exposed via `useMoney()`) always convert through EUR using `meta.rateRubPerEur` and `meta.rateUsdtPerEur` (fetched/cached server-side, refreshed periodically). A `price` on an asset is treated as a *monthly* recurring cost throughout P&L/stats — there's no separate billing-cycle-normalization for the headline numbers (`assetCycleDays` exists but is informational only, shown in the record's UI, not used to normalize `monthlyCost`).

## Style conventions seen in this codebase

- Records/assets are called "записи" (records) in Russian UI copy, not "servers", except where specifically talking about `type: vps` items.
- Faded/secondary numeric values (e.g. a RUB-equivalent shown next to a USDT amount) use `<small className="stat-card-sub">` — `opacity: 0.72; color: var(--muted); font-size: 12px; font-weight: 700` (bumped from 0.5/0.55 for readability — see the comments on `--muted` and `.stat-card-sub` in `globals.css`).
- Collapsible groups of cards use `web/components/ui/Accordion.jsx`'s `AccordionRoot`/`AccordionItem` (`type="single" collapsible` for true accordion behavior — only one section open at a time) with `AccordionTrigger` styled as `.category-group-summary` or `.asset-type-head`, not raw Radix `Accordion.*` (the wrapper's the one with the height-animation CSS wired up).
- Assets are never hard-deleted from the UI's normal flow — they carry an `inactive` boolean column (`server.js`) and get soft-deactivated instead, preserving payment history.
