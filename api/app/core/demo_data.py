"""Populates a handful of realistic providers/assets/payments for local dev
so a fresh DATA_DIR isn't an empty shell — ported from server.js's
seedDemoAssets/seedDemoBotRevenueMonthly. Opt-in only (SEED_DEMO_DATA=true)
and only when the DB is genuinely empty, so it can never touch a real
deployment and won't re-seed/duplicate on every dev restart against the
same scratch DATA_DIR.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.bot_revenue import BOT_REVENUE_MONTH_SECONDS, aggregate_bot_transactions, build_demo_bot_transactions, upsert_bot_revenue_monthly
from app.core.records import normalize_asset, normalize_provider, upsert_asset, upsert_provider
from app import models


def _in_days(n: int) -> str:
    return (datetime.now() + timedelta(days=n)).strftime("%Y-%m-%dT%H:%M")


def _days_ago(n: int) -> str:
    return (datetime.now() - timedelta(days=n)).strftime("%Y-%m-%d")


def _months_ago(n: int) -> str:
    return _days_ago(n * 30)


def _payments(entries: list[tuple[float, str, int]]) -> list[dict]:
    return [{"amount": amount, "currency": currency, "paidAt": _months_ago(months_back)} for amount, currency, months_back in entries]


# The Payments tab only counts vps-type payments and defaults to a 30-day
# window — a handful of monthly-cadence payments (as `_payments()` above
# gives) mostly falls just outside every short window, leaving it looking
# empty. This spread guarantees points inside every period filter
# (7d/30d/90d/180d/1y/all) with several within the last month for an
# actual line, not a single dot.
_RECURRING_OFFSETS = [2, 9, 16, 23, 40, 70, 100, 160, 250, 350]


def _recurring(amount: float, currency: str) -> list[dict]:
    return [{"amount": amount, "currency": currency, "paidAt": _days_ago(d)} for d in _RECURRING_OFFSETS]


def seed_demo_assets(db: Session) -> None:
    if db.query(models.Provider).count() > 0 or db.query(models.Asset).count() > 0:
        return

    hostup = upsert_provider(db, normalize_provider({"name": "HostUp", "loginUrl": "https://hostup.example/login", "note": "Ноды и тестовые сервера"}))
    cloudbase = upsert_provider(db, normalize_provider({"name": "CloudBase", "loginUrl": "https://cloudbase.example/login", "note": "Базы данных и кэш"}))
    regdomains = upsert_provider(db, normalize_provider({"name": "RegDomains", "loginUrl": "https://regdomains.example/login", "note": "Регистратор доменов"}))
    ssltrust = upsert_provider(db, normalize_provider({"name": "SSL Trust", "loginUrl": "https://ssltrust.example/login", "note": "Сертификаты"}))

    assets = [
        {"type": "vps", "name": "node-fra-01", "providerId": hostup["id"], "category": "node", "countryCode": "DE", "ip": "45.12.34.10", "price": 12, "priceCurrency": "USDT", "expiresAt": _in_days(3), "payments": _recurring(12, "USDT")},
        {"type": "vps", "name": "node-ams-02", "providerId": hostup["id"], "category": "node", "countryCode": "NL", "ip": "45.12.34.20", "price": 15, "priceCurrency": "USDT", "expiresAt": _in_days(20), "payments": _recurring(15, "USDT")},
        {"type": "vps", "name": "infra-db-01", "providerId": cloudbase["id"], "category": "infra", "countryCode": "US", "ip": "185.22.1.5", "description": "Основная Postgres-база, ежедневный бэкап в 03:00 UTC", "price": 40, "priceCurrency": "EUR", "expiresAt": _in_days(45), "payments": _recurring(40, "EUR")},
        {"type": "vps", "name": "infra-cache-01", "providerId": cloudbase["id"], "category": "infra", "countryCode": "US", "ip": "185.22.1.9", "price": 8, "priceCurrency": "USDT", "expiresAt": _in_days(-2), "payments": _recurring(8, "USDT")},
        {"type": "vps", "name": "test-sandbox", "providerId": hostup["id"], "category": "test", "countryCode": "RU", "ip": "10.0.0.5", "price": 5, "priceCurrency": "USDT", "expiresAt": _in_days(10), "inactive": True, "payments": []},
        {"type": "domain", "name": "example-project.com", "providerId": regdomains["id"], "price": 12, "priceCurrency": "USDT", "expiresAt": _in_days(60), "payments": _payments([(12, "USDT", 11)])},
        {"type": "domain", "name": "vpn-service.io", "providerId": regdomains["id"], "price": 10, "priceCurrency": "EUR", "expiresAt": _in_days(5), "payments": _payments([(10, "EUR", 11)])},
        {"type": "certificate", "name": "wildcard.example.com", "providerId": ssltrust["id"], "price": 3, "priceCurrency": "USDT", "expiresAt": _in_days(25), "payments": _payments([(3, "USDT", 11)])},
        {"type": "certificate", "name": "api.example.com", "providerId": ssltrust["id"], "price": 3, "priceCurrency": "USDT", "expiresAt": _in_days(-1), "payments": _payments([(3, "USDT", 11)])},
    ]
    for index, asset_input in enumerate(assets):
        upsert_asset(db, normalize_asset(db, {**asset_input, "sortOrder": index}))


# Independent of seed_demo_assets() (own idempotency check against its own
# table) so it backfills even into a DB that was already seeded before this
# existed. Pre-populates bot_revenue_monthly so the Finance monthly chart has
# data from the very first page load — fetch_bot_revenue()'s own demo branch
# upserts the same table as a side effect too, but only after /api/bot/revenue
# has been called at least once.
def seed_demo_bot_revenue_monthly(db: Session) -> None:
    if db.query(models.BotRevenueMonthly).count() > 0:
        return
    month_ago = time.time() - BOT_REVENUE_MONTH_SECONDS
    upsert_bot_revenue_monthly(db, aggregate_bot_transactions(build_demo_bot_transactions(), month_ago)["monthTotals"])


def seed_demo_data(db: Session) -> None:
    from app.core.config import get_settings

    if not get_settings().seed_demo_data:
        return
    seed_demo_assets(db)
    seed_demo_bot_revenue_monthly(db)
