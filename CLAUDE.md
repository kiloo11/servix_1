# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SERVIX is a self-hosted panel for tracking servers, domains, certificates, hosting providers, payments and expiration dates, with Telegram notifications. Python (FastAPI) backend + React/Next.js SPA frontend, SQLite storage (SQLAlchemy + Alembic).

## Commands

```bash
pip install -e api                        # install backend deps
npm run dev                                # Next.js dev server on :5173 (frontend only, proxies /api to :3000)
npm run server                             # backend on :3000, loads .env if present (alias: npm start)
npm run build                              # installs web/'s deps + Next static export -> dist/
cd api && pytest                           # backend test suite (needs the api/.venv or an equivalent env active)
```

To develop locally you run **both** `npm run server` and `npm run dev` at the same time (two terminals) — the backend serves the API on :3000, the Next.js dev server proxies `/api/*` to it (see `web/next.config.js`'s `rewrites()`, dev-only) and serves the SPA with Fast Refresh on :5173.

There is no frontend test suite, no lint script, and no TypeScript in this repo — don't invent `npm test`/`npm run lint` commands. The frontend is plain `.jsx`, matching that convention deliberately (not an oversight). The backend does have a pytest suite (`api/tests/`) but no lint/format tooling configured either.

Production runs `npm run build` then the Python backend (`uvicorn --app-dir api app.main:app`), which serves the built SPA from `dist/` and the API from the same process/port (see Dockerfile: multi-stage build — a Node stage builds `web/`'s static export, the final image is `python:3.12-slim` and ships only `package.json`, `locale/`, `dist/`, and `api/`).

### Local demo/verification instance

Never point a dev server at the real `./data` directory when just testing a UI change. `npm run dev:server` runs the backend against an isolated, gitignored `./.devdata` `DATA_DIR` and sets `SEED_DEMO_DATA=true`, which seeds a handful of realistic providers/assets/payments (mixed types, categories, currencies, expiry states — overdue/due-soon/future, one inactive) the first time that DB is created; it's a no-op once the DB already has any providers/assets, so it's safe to leave set across restarts. You still need to create a demo user once via `POST /api/auth/setup` (`{"login":"demo","password":"...","passwordRepeat":"..."}`) — seeding covers business data, not auth.

For a one-off scratch instance instead (e.g. testing against an empty panel), point `DATA_DIR` at any other folder without `SEED_DEMO_DATA`:

```bash
DATA_DIR=/path/to/scratch/data python3 -m uvicorn --app-dir api app.main:app --port 3000
```

### Configuration

First-run config (`SITE_TITLE`, `APP_TIMEZONE`, `TELEGRAM_NOTIFY_URL`, `NOTIFY_ON_START`) is seeded from env vars but then persisted in the DB and edited from the Settings page — env vars only matter before the first row exists. `DATA_DIR` (default `./data`) and `COOKIE_SECURE` (set `true` behind an HTTPS reverse proxy) are the only env vars that matter on every run. Only one process should ever open the SQLite file at `DATA_DIR/servix.sqlite`.

## Architecture

### Backend: `api/`, FastAPI

`api/app/` is the backend: FastAPI + Uvicorn, SQLAlchemy 2.x models (`app/models.py`) with Alembic migrations (`api/alembic/`) against the same single SQLite file, session auth with TOTP 2FA (`app/core/sessions.py`/`security.py`/`users.py`), Telegram notifications (`app/core/notify_text.py`, scheduled via APScheduler in `app/core/scheduler.py`), and a JSON REST API. Routes are split into per-concern routers under `app/routers/` (`auth`, `data` — assets/providers/categories/settings/logs/notifications/rates, `bot`, `update`, `telegram`, `bedolaga`, `dashboard`), each `include_router`'d in `app/main.py::create_app()`. `app/core/static_files.py::serve_static` serves `dist/` — first as a literal file, then (since Next's static export lays each route out as `<route>/index.html`) tries `<path>/index.html`, then falls back to the root SPA shell for anything else — registered as a catch-all route in `main.py`, after every `/api/*` router has had a chance to match. `app/main.py::run_migrations()` also has a one-time self-healing bootstrap: a DB file that predates Alembic (no `alembic_version` row, but the tables already exist) gets auto-stamped at the initial-schema revision before `upgrade head` runs, so an existing production DB can be pointed at this backend directly with no manual migration step.

Key endpoint: `GET /api/assets` returns everything the frontend needs in one shot — `{ meta, providers, assets }`, where each asset has its `payments` array embedded (joined in `app/core/records.py::get_data()`). Most other endpoints are `POST/PUT/DELETE /api/providers[/:id]` and `/api/assets[/:id]`, following the same normalize-then-upsert pattern (`normalize_asset`/`normalize_provider` + `upsert_asset`/`upsert_provider`, all in `app/core/records.py`).

Notifications are scheduled via APScheduler jobs computed from the next due event, not a polling loop — when an asset's `expiresAt` changes, the job is recomputed.

Records have a `type`: `vps` (= "servers" everywhere in the UI/naming), `domain`, or `certificate`. `vps`-type assets additionally carry a `category`: `infra`, `node`, or `test` by default, but categories are now a user-managed table (`app/core/records.py`'s category functions), not a fixed const — this category concept does not apply to domains/certificates.

The CSP allows `'unsafe-inline'` for `script-src` — required because Next's App Router bootstraps hydration via inline `<script>self.__next_f.push(...)</script>` tags in every static export, which a per-request nonce can't cover without a real server. Don't tighten this back to `'self'`-only without switching the frontend off App Router.

### Frontend: `web/`, Next.js App Router, one context per concern

`web/` is a self-contained Next.js 16 / React 19 app (its own `package.json`, `node_modules`) that imports `locale/*.json` from the repo root (`web/lib/i18n.js` does `../../locale/*.json`) — that's why `web/next.config.js` sets `turbopack.root` one level up from `web/`, and why the Dockerfile copies `web/` and `locale/` as siblings into the build stage. Real per-route pages live under `web/app/(dashboard)/*/page.jsx`: nav items are `/` (labelled "Финансы", tabbed: Дашборд/Overview/Payments/Rates — merges the primary SaaS-metrics Дашборд with what used to be separate Stats and P&L pages), `/assets`, `/providers`, `/ads`, plus `/alerts`, `/logs`, `/guide`, `/settings` off the primary nav. `/finance`, `/stats`, and `/pnl` still exist as thin client-side redirects into `/` (with the matching tab hash) for old bookmarks, not real pages anymore. `web/app/login/page.jsx` handles the setup/login/2FA flow — routing, auth-gating (`web/app/(dashboard)/layout.jsx`), and browser back/forward are all just Next's own router.

Shared state lives in React Context providers nested in `web/app/layout.jsx` (`LocaleProvider` → `ToastProvider` → `AuthProvider` → `DataProvider` → `ConfirmProvider`): `AuthContext` owns the boot/login/2FA sequence and `meta`; `DataContext` owns `assets`/`providers`/`alerts`/`security`/`update` plus the raw CRUD primitives (each one reloads after mutating). Business actions (confirm dialogs, toasts, i18n messages) are composed in `web/lib/assetActions.js` (`useAssetActions()`) and `web/lib/updateActions.js` (`useUpdateActions()`) — hooks that pull from `useData()`/`useToast()`/`useConfirm()`/`useLocale()` together, so a component just calls e.g. `saveAsset(draft)` without wiring the confirm/toast/reload sequence itself. Ephemeral per-page UI state (search text, table sort/page, which modal is open) is **not** centralized — each page/modal owns it locally, since real routes unmount on navigation (revisiting a page resets its filters, which is standard for real routes and hasn't been treated as a regression to fix).

Styling is one global stylesheet, `web/app/globals.css` (Tailwind v4, CSS-first config via `@theme` — no `tailwind.config.js`), imported once in the root layout. It carries the design tokens (`--color-bg`/`--color-accent`/GT Eesti fonts/`.glass` surfaces — originally from a separate marketing site's design system, not this codebase) plus dashboard-specific component classes (`.stat-card-sub`, `.category-badge`/`.category-group`, `.asset-type-head`, `.provider-card`, `.finance-tabs`, etc.). Components don't use CSS modules or styled-jsx; new UI reuses these existing classes.

UI primitives come from the unified `radix-ui` npm package, wrapped in `web/components/ui/` (`AppSelect`/`AppSelectItem`, `Modal`, `AppTooltip`, `Accordion`) — reuse these wrappers instead of importing `radix-ui` primitives directly in pages. Note: Radix's `Select.Item` cannot take an empty-string `value`; `AppSelect`/`AppSelectItem` internally remap `""` to a sentinel (`web/lib/selectEmptyValue.js`) so consumers can keep using `""` to mean "no selection". `Modal.jsx` is the single dialog component used everywhere (asset/provider forms, payments, confirm dialogs, etc.) — changes to `.dialog-head`/`.dialog-actions` styling affect every modal in the app, not just one. Framer Motion drives the modal/toast enter-exit animations; the accordion instead uses Radix's own `--radix-accordion-content-height` CSS-var approach (cheaper than a JS-measured height animation for something that toggles as often as category groups do).

### i18n

`locale/ru.json` and `locale/en.json` (repo root, shared by both the frontend and the backend) hold UI strings (`ru` is the primary/default locale) — this is the only source of truth, always edit these, never anything under `web/locale/`. `web/lib/i18n.js` has the `translate`/`translatePlural`/`getPath`/`interpolate`/`pluralIndex` functions, bound to React via `LocaleContext`'s `useLocale()` hook (`t`/`tc`/`tList`). `tc` handles Russian 3-form pluralization (`plural.<key>: [one, few, many]`) via `pluralIndex`. The backend (`api/app/core/locale.py`) has its own separate, much smaller copy of the same `t`/`tc`/`load_locales` pattern for building Telegram notification text — the two are not shared code, so a new user-facing string used in both places needs to be added twice.

`web/lib/i18n.js` imports from `../locale/*.json` (inside `web/`), not the repo-root files directly — `web/scripts/locale-sync.js` copies them in via npm's `predev`/`prebuild` hooks (`web/package.json`), and `web/scripts/dev.js` (what `npm run dev` actually runs) also keeps an `fs.watch` on the real source so edits still hot-reload. This exists only so `next.config.js` can leave `turbopack.root` at its default (`web/` itself) instead of the repo root: pointing it at the repo root used to make Turbopack's dev-server watcher span `api/.venv`, `.git`, `dist`, and `data` too — measured at 600-700% sustained CPU at idle. `web/locale/` is gitignored, generated, never commit it.

### Versioning and self-update

The single source of truth for the version is `package.json` — `api/app/core/config.py::get_app_version()`
reads it at startup and returns it in `meta.version`, and the release workflow refuses
to publish a tag that disagrees with it. A release is a `vX.Y.Z` tag; `.github/workflows/release.yml`
builds and pushes `ghcr.io/<repo>:latest` and `:vX.Y.Z`. Note the entries in `CHANGELOG.md`.

`GET /api/update` reports current vs latest version (GitHub releases, falling back to tags),
`POST /api/update/check` forces a re-check, `POST /api/update/apply` starts the update and
returns 202 (`api/app/core/update.py`). Two things there are deliberate: the container never
recreates itself (the Docker daemon would kill the process mid-update, leaving the panel down),
so a one-shot watchtower container launched through the docker socket does it; and the socket is
spoken to directly over the Engine API with an async `httpx` unix-socket transport, so the image
needs no docker CLI. Without a mounted socket `canApply` is false and the UI only reports versions — that must
stay a graceful downgrade, not an error.

### Money/currency

Three currencies exist: `USDT`, `EUR`, `RUB`. `EUR` is the backend's internal pivot: `convertAmount`/`convertToEur` (`web/lib/money.js`, exposed via `useMoney()`) always convert through EUR using `meta.rateRubPerEur` and `meta.rateUsdtPerEur` (fetched/cached server-side, refreshed periodically). A `price` on an asset is treated as a *monthly* recurring cost throughout P&L/stats — there's no separate billing-cycle-normalization for the headline numbers (`assetCycleDays` exists but is informational only, shown in the record's UI, not used to normalize `monthlyCost`).

## Style conventions seen in this codebase

- Records/assets are called "записи" (records) in Russian UI copy, not "servers", except where specifically talking about `type: vps` items.
- Faded/secondary numeric values (e.g. a RUB-equivalent shown next to a USDT amount) use `<small className="stat-card-sub">` — `opacity: 0.72; color: var(--muted); font-size: 12px; font-weight: 700` (bumped from 0.5/0.55 for readability — see the comments on `--muted` and `.stat-card-sub` in `globals.css`).
- Collapsible groups of cards use `web/components/ui/Accordion.jsx`'s `AccordionRoot`/`AccordionItem` (`type="single" collapsible` for true accordion behavior — only one section open at a time) with `AccordionTrigger` styled as `.category-group-summary` or `.asset-type-head`, not raw Radix `Accordion.*` (the wrapper's the one with the height-animation CSS wired up).
- Assets are never hard-deleted from the UI's normal flow — they carry an `inactive` boolean column (`api/app/models.py`) and get soft-deactivated instead, preserving payment history.
