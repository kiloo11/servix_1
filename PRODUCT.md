# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo operator (the developer/deployer themself) running one self-hosted instance end-to-end — there is no roles/teams concept in the data model (a single `User` table), and the account this instance runs under also operates a Bedolaga-based VPN subscription business.

## Product Purpose

SERVIX is a self-hosted cockpit for running a small VPN-reselling business: it tracks the infrastructure the business depends on (servers, domains, TLS certificates, hosting providers, payment/expiration dates) and, via a Bedolaga sync integration, the business's own subscriber economics (cash revenue, bookings/recognized MRR, ARPU, gross margin, churn, average subscriber lifetime). Success is not missing a renewal or expiry (Telegram alerts before things lapse) while having real financial visibility into the subscription business without a separate spreadsheet or SaaS analytics tool.

## Positioning

Unifies two things that are normally tracked in separate tools — infra/expiry tracking and real subscriber-revenue analytics (MRR, churn, ARPU, subscriber lifetime) computed directly from the operator's own Bedolaga bot data — in one self-hosted panel with no SaaS dependency and no data leaving the operator's own server.

## Operating Context

- Deployed via Docker Compose (or bare `npm run build` + `pip install -e api` + `npm start`) on infrastructure the operator controls, typically behind a Caddy HTTPS reverse proxy.
- Bedolaga sync runs on a schedule (plus a manual "sync now" trigger in Settings) to pull transactions/subscriptions/users into local tables that the financial metrics are computed from.
- Telegram is the notification channel for upcoming expirations, scheduled per-asset (not polled) and reconfigurable per period (`5m,2h,1d,3d,...`).
- Money is multi-currency at the asset level (USDT/EUR/RUB, EUR as the conversion pivot) but Bedolaga's own numbers are RUB-native.
- Single SQLite file (`data/servix.sqlite`) — only one process may ever open it; there is no multi-instance/HA deployment mode.

## Capabilities and Constraints

- Tracks three record types (servers/"vps", domains, certificates) plus providers (with favicon, color, notes, login URL) and per-record payment history.
- Records are soft-deleted only (an `inactive` flag) — never hard-deleted from the normal UI flow, to preserve payment history.
- Self-update checks GitHub releases and can apply an update via a one-shot watchtower container over the Docker socket; without a mounted socket it degrades to version-reporting only, never an error.
- Single admin account per instance, with optional TOTP 2FA. No multi-tenant or role-based access — this is intentionally a single-operator tool, not a team product.
- i18n: Russian is the primary/default locale, English is secondary; both are first-class, not machine-translated afterthoughts.
- Installable as a PWA from the browser.
- Self-hosted only — there is no hosted/SaaS version and no plan for one implied by the architecture (single local SQLite file, env-seeded first-run config, Docker-socket self-update).

## Brand Commitments

- Name: SERVIX. No other naming, tagline, or logo commitments beyond the existing `app-icon.svg` and site title (user-configurable per instance via Settings, not a fixed brand string).
- License: MIT.

## Evidence on Hand

- Real Bedolaga sync data (transactions, subscriptions, users) once `BEDOLAGA_API_URL`/`BEDOLAGA_API_KEY` are configured on a given instance — financial metrics are computed live from this, not from fabricated or sample figures.
- `CHANGELOG.md` is a real, maintained version history (not a placeholder).
- No testimonials, case studies, pricing, or press exist or should be fabricated — this is an internal operator tool, not a marketed product with customers to cite.

## Product Principles

1. Never lose track of an expiration — infra and financial state must stay visible without the operator having to go looking for it (hence scheduled Telegram alerts rather than a dashboard the operator must remember to check).
2. Self-hosted and self-contained — no required third-party SaaS dependency for the panel to function; integrations (Telegram, Bedolaga) are optional and degrade gracefully (e.g. `configured: false` states) when unset.
3. Financial numbers are computed, not entered — MRR/churn/ARPU/lifetime are derived live from synced transaction data, so they can't drift out of sync with reality the way a manually maintained spreadsheet does.
4. Preserve history over convenience — soft-delete only, so payment/record history is never accidentally destroyed.
5. Single-operator simplicity over team features — no roles, no multi-tenancy; complexity that would only serve a team use case is deliberately out of scope.

## Accessibility & Inclusion

No formally required standard, but the current UI is being actively held to WCAG AA text-contrast (4.5:1) as a working bar — this session's light-theme conversion specifically fixed several badge/status-text combinations that fell to ~2.5–3.4:1. Future visual work should not regress below that.
