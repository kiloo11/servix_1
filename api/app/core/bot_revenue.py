"""Bedolaga bot revenue (deposits) — ported from server.js's fetchBotRevenue/
aggregateBotTransactions/buildDemoBotTransactions/upsertBotRevenueMonthly/
getBotRevenueMonthly family. Same in-process cache shape (single-process app,
restart = cold cache, matches Node behavior).
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dates import iso_from_timestamp, now_iso
from app import models

logger = logging.getLogger(__name__)

BOT_REVENUE_CACHE_SECONDS = 12 * 60 * 60
BOT_REVENUE_MAX_ITEMS = 300
BOT_REVENUE_MONTH_SECONDS = 30 * 24 * 60 * 60
FETCH_TIMEOUT_SECONDS = 10

_cache: dict | None = None  # {"data": dict, "fetched_at": float}


def upsert_bot_revenue_monthly(db: Session, month_totals: dict[str, dict[str, int]]) -> None:
    if not month_totals:
        return
    now = now_iso()
    for month, bucket in month_totals.items():
        row = db.get(models.BotRevenueMonthly, month)
        if row is None:
            row = models.BotRevenueMonthly(month=month)
            db.add(row)
        row.total_kopeks = bucket["kopeks"]
        row.count = bucket["count"]
        row.updated_at = now
    db.commit()


def get_bot_revenue_monthly(db: Session, months_back: int = 12) -> list[dict]:
    rows = db.scalars(
        select(models.BotRevenueMonthly).order_by(models.BotRevenueMonthly.month.desc()).limit(months_back)
    ).all()
    return [{"month": row.month, "totalRub": row.total_kopeks / 100, "count": row.count} for row in reversed(rows)]


def get_bot_revenue_for_month(db: Session, month_key: str) -> float:
    row = db.get(models.BotRevenueMonthly, month_key)
    return row.total_kopeks / 100 if row else 0.0


def month_key_of(dt: datetime) -> str:
    return f"{dt.year}-{dt.month:02d}"


async def _fetch_bedolaga_transaction_pages() -> list[dict]:
    settings = get_settings()
    limit = 200
    max_pages = 25
    offset = 0
    total = float("inf")
    raw_items: list[dict] = []
    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
        for _ in range(max_pages):
            if offset >= total:
                break
            response = await client.get(
                f"{settings.bedolaga_api_url_clean}/transactions",
                params={"limit": limit, "offset": offset, "type": "deposit", "is_completed": "true"},
                headers={"X-API-Key": settings.bedolaga_api_key},
            )
            if response.is_error:
                raise RuntimeError(f"Bedolaga API HTTP {response.status_code}")
            data = response.json()
            page_items = data.get("items") if isinstance(data.get("items"), list) else []
            raw_items.extend(page_items)
            total = float(data.get("total", len(page_items)))
            offset += limit
            if not page_items:
                break
    return raw_items


def _parse_timestamp(value: str) -> float:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return float("-inf")


def aggregate_bot_transactions(raw_items: list[dict], month_ago: float) -> dict:
    total_kopeks = 0
    month_kopeks = 0
    count = 0
    month_count = 0
    items = []
    month_totals: dict[str, dict[str, int]] = {}
    for item in raw_items:
        if not item.get("payment_method"):
            continue
        kopeks = int(item.get("amount_kopeks") or 0)
        created_at = item.get("completed_at") or item.get("created_at") or ""
        is_recent = _parse_timestamp(created_at) >= month_ago if created_at else False
        total_kopeks += kopeks
        count += 1
        if is_recent:
            month_kopeks += kopeks
            month_count += 1
        items.append(
            {
                "id": item.get("id"),
                "userId": item.get("user_id"),
                "amountRub": float(item.get("amount_rubles", kopeks / 100)),
                "paymentMethod": str(item.get("payment_method") or ""),
                "description": str(item.get("description") or ""),
                "createdAt": created_at,
            }
        )
        month_key = created_at[:7]
        if len(month_key) == 7 and month_key[4] == "-" and month_key[:4].isdigit() and month_key[5:].isdigit():
            bucket = month_totals.setdefault(month_key, {"kopeks": 0, "count": 0})
            bucket["kopeks"] += kopeks
            bucket["count"] += 1
    return {
        "totalKopeks": total_kopeks,
        "monthKopeks": month_kopeks,
        "count": count,
        "monthCount": month_count,
        "items": items,
        "monthTotals": month_totals,
    }


def build_demo_bot_transactions() -> list[dict]:
    now = time.time()
    methods = ["yookassa", "cryptobot", "stars", "sbp"]
    items = []
    for i in range(42):
        days_back = round((i / 42) * 175)
        amount_rub = 150 + ((i * 137) % 2350)
        completed_at = iso_from_timestamp(now - days_back * 86_400)
        items.append(
            {
                "id": f"demo-{i}",
                "user_id": 100000 + i,
                "amount_kopeks": round(amount_rub * 100),
                "amount_rubles": amount_rub,
                "payment_method": methods[i % len(methods)],
                "description": "",
                "completed_at": completed_at,
            }
        )
    return items


def _finalize(aggregated: dict) -> dict:
    items = sorted(aggregated["items"], key=lambda item: str(item["createdAt"]), reverse=True)
    return {
        "configured": True,
        "totalRub": aggregated["totalKopeks"] / 100,
        "monthRub": aggregated["monthKopeks"] / 100,
        "count": aggregated["count"],
        "monthCount": aggregated["monthCount"],
        "items": items[:BOT_REVENUE_MAX_ITEMS],
        "updatedAt": now_iso(),
    }


async def fetch_bot_revenue(db: Session, force: bool = False) -> dict:
    global _cache
    settings = get_settings()

    if not settings.bedolaga_api_url_clean or not settings.bedolaga_api_key:
        if not settings.seed_demo_data:
            return {"configured": False, "totalRub": 0, "monthRub": 0, "count": 0, "monthCount": 0, "items": [], "updatedAt": ""}
        month_ago = time.time() - BOT_REVENUE_MONTH_SECONDS
        aggregated = aggregate_bot_transactions(build_demo_bot_transactions(), month_ago)
        upsert_bot_revenue_monthly(db, aggregated["monthTotals"])
        return _finalize(aggregated)

    if not force and _cache is not None and time.time() - _cache["fetched_at"] < BOT_REVENUE_CACHE_SECONDS:
        return _cache["data"]

    try:
        month_ago = time.time() - BOT_REVENUE_MONTH_SECONDS
        raw_items = await _fetch_bedolaga_transaction_pages()
        aggregated = aggregate_bot_transactions(raw_items, month_ago)
        upsert_bot_revenue_monthly(db, aggregated["monthTotals"])
        result = _finalize(aggregated)
        _cache = {"data": result, "fetched_at": time.time()}
        return result
    except Exception as error:  # noqa: BLE001 - matches server.js's catch-and-fall-back-to-stale-cache
        logger.warning("Bedolaga revenue fetch failed: %s", error)
        if _cache is not None:
            return _cache["data"]
        return {
            "configured": True,
            "totalRub": 0,
            "monthRub": 0,
            "count": 0,
            "monthCount": 0,
            "items": [],
            "updatedAt": "",
            "error": str(error),
        }
