# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SERVIX is a self-hosted panel for tracking servers, domains, certificates, hosting providers, payments and expiration dates, with Telegram notifications. Single Node.js backend + Vue 3 SPA frontend, SQLite storage, no external framework on either side (no Express, no Vue Router, no Vuex/Pinia).

## Commands

```bash
npm install         # install deps
npm run dev          # Vite dev server on :5173 (frontend only, proxies /api to :3000)
npm run server       # backend on :3000, loads .env if present (alias: npm start)
npm run build         # vite build -> dist/
```

To develop locally you run **both** `npm run server` and `npm run dev` at the same time (two terminals) — the backend serves the API on :3000, the Vite dev server proxies `/api/*` to it (see `vite.config.js`) and serves the SPA with HMR on :5173.

There is no test suite, no lint script, and no TypeScript in this repo — don't invent `npm test`/`npm run lint` commands.

Production runs `npm run build` then `node server.js`, which serves the built SPA from `dist/` and the API from the same Node process/port (see Dockerfile: multi-stage build, final image only ships `server.js`, `locale/`, and `dist/`).

### Local demo/verification instance

Never point a dev server at the real `./data` directory when just testing a UI change. Start the backend with an isolated `DATA_DIR` pointing at a scratch folder, e.g.:

```bash
DATA_DIR=/path/to/scratch/data node --env-file-if-exists=.env server.js
```

Then create a demo user via `POST /api/auth/setup` (`{"login":"demo","password":"...","passwordRepeat":"..."}`) and seed a couple of providers/assets via `POST /api/providers` and `POST /api/assets`.

### Configuration

First-run config (`SITE_TITLE`, `APP_TIMEZONE`, `TELEGRAM_NOTIFY_URL`, `NOTIFY_ON_START`) is seeded from env vars but then persisted in the DB and edited from the Settings page — env vars only matter before the first row exists. `DATA_DIR` (default `./data`) and `COOKIE_SECURE` (set `true` behind an HTTPS reverse proxy) are the only env vars that matter on every run. Only one process should ever open the SQLite file at `DATA_DIR/servix.sqlite`.

## Architecture

### Backend: one file, no framework

`server.js` (~1400 lines) is the entire backend: raw `node:http` server, `node:sqlite` (`DatabaseSync`, requires Node 24+) for storage, hand-rolled session auth with TOTP 2FA, Telegram notifications, and a JSON REST API. There's no router library — `handleApi(req, res, url)` is one long chain of `if (req.method === "X" && url.pathname === "/api/y")` checks. `serveStatic` serves `dist/` with SPA-style fallback to `index.html` for unknown paths, and the request handler at the bottom dispatches on `url.pathname.startsWith("/api/")`.

Key endpoint: `GET /api/assets` returns everything the frontend needs in one shot — `{ meta, providers, assets }`, where each asset has its `payments` array embedded (joined server-side in `getData()`). Most other endpoints are `POST/PUT/DELETE /api/providers[/:id]` and `/api/assets[/:id]`, following the same normalize-then-upsert pattern (`normalizeAsset`/`normalizeProvider` + `upsertAsset`/`upsertProvider`).

Notifications are scheduled with real `setTimeout`s computed from the next due event (`scheduleNotifications`/`processDueNotifications`), not a polling loop — when an asset's `expiresAt` changes, the timer is recomputed.

Records have a `type`: `vps` (= "servers" everywhere in the UI/naming), `domain`, or `certificate`. `vps`-type assets additionally carry a `category`: `infra`, `node`, or `test` (the `CATEGORIES` const) — this category concept does not apply to domains/certificates.

### Frontend: one root component holds everything

There is no Vue Router and no state management library. `src/App.vue` (~2000 lines) owns *all* application state (`data()`), computed properties, and methods (API calls, formatting, i18n). Navigation between pages is a plain `view` string in `App.vue`'s data, toggled via `go(view)`; `src/views/*View.vue` components are all mounted simultaneously and shown/hidden with `v-show="view === '...'"` (see the `<main class="content">` block in `App.vue`).

Every view/component receives the whole root instance as a prop conventionally named `app` (`app: appContext` where `appContext` is a computed returning `this`). Views call `app.someMethod()` / read `app.someState` directly instead of having their own local state or emitting events upward — there's no props-down/events-up pattern here, just "reach into `app`". When adding a feature to a view, the corresponding data/computed/method almost always needs to be added to `App.vue`, not the view file.

Styling is one global stylesheet, `src/styles.css` (~3200 lines), imported once in `src/main.js`. Components do not use `<style scoped>`. New UI reuses existing classes (`.stat-card-sub` for faded secondary text, `.category-badge`/`.category-group`, `.asset-type-head`, `.provider-card`, etc.) rather than introducing component-scoped styles.

UI primitives (`reka-ui`, a Radix-Vue-style headless library) are wrapped in `src/components/` (`AppSelect`/`AppSelectItem`, `Modal`, `AppTooltip`) — reuse these wrappers instead of importing `reka-ui` primitives directly in views. Note: `reka-ui`'s `SelectItem` cannot take an empty-string `value`; `AppSelect`/`AppSelectItem` internally remap `""` to a sentinel (`src/components/appSelectEmptyValue.js`) so consumers can keep using `""` to mean "no selection".

`Modal.vue` is the single dialog component used everywhere (asset/provider forms, payments, confirm dialogs, etc.) — changes to `.dialog-head`/`.dialog-actions` styling affect every modal in the app, not just one.

### i18n

`locale/ru.json` and `locale/en.json` hold UI strings (`ru` is the primary/default locale). `App.vue` has its own `t(key, params)` / `tc(key, count, params)` helpers (`translate`/`translatePlural` module functions) that walk dot-path keys and do `{param}` interpolation; `tc` additionally handles Russian 3-form pluralization (`plural.<key>: [one, few, many]`) via `pluralIndex`. The backend (`server.js`) has its own separate, much smaller copy of the same `t`/`tc`/`loadLocales` pattern for building Telegram notification text — the two are not shared code, so a new user-facing string used in both places needs to be added twice.

### Money/currency

Three currencies exist: `USDT`, `EUR`, `RUB`. `EUR` is the backend's internal pivot: `convertAmount`/`convertToEur` in `App.vue` always convert through EUR using `meta.rateRubPerEur` and `meta.rateUsdtPerEur` (fetched/cached server-side, refreshed periodically). A `price` on an asset is treated as a *monthly* recurring cost throughout P&L/stats — there's no separate billing-cycle-normalization for the headline numbers (`assetCycleDays` exists but is informational only, shown in the record's UI, not used to normalize `monthlyCost`).

## Style conventions seen in this codebase

- Records/assets are called "записи" (records) in Russian UI copy, not "servers", except where specifically talking about `type: vps` items.
- Faded/secondary numeric values (e.g. a RUB-equivalent shown next to a USDT amount) use `<small class="stat-card-sub">` — `opacity: 0.5; color: var(--muted); font-size: 12px; font-weight: 700`.
- Collapsible groups of cards use `reka-ui`'s `AccordionRoot`/`AccordionItem` (type="single" collapsible for true accordion behavior — only one section open at a time) with `AccordionTrigger` styled as `.category-group-summary` or `.asset-type-head`, not the plain `Collapsible*` primitives (those don't coordinate open/close across siblings).
- Assets are never hard-deleted from the UI's normal flow — they carry an `inactive` boolean column (`server.js`) and get soft-deactivated instead, preserving payment history.
