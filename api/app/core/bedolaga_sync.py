"""Bedolaga data sync — pulls transactions/subscriptions/users from the
Bedolaga API into local tables so Phase 3's metrics engine has real history
to compute from, instead of just the rolling revenue totals bot_revenue.py
keeps. See the Phase 2 section of the plan for the data-shape findings this
is built on (transaction types, revenue model, why subscriptions need a
daily rollup instead of being trusted as historical on their own).
"""

from __future__ import annotations

import logging
from datetime import datetime

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.core.config import get_settings
from app.core.dates import now_iso
from app.core.meta import set_meta

logger = logging.getLogger(__name__)

PAGE_LIMIT = 200
TRANSACTIONS_MAX_PAGES = 1000
FETCH_TIMEOUT_SECONDS = 15

LAST_TRANSACTION_ID_KEY = "bedolagaLastTransactionId"
LAST_SYNC_AT_KEY = "bedolagaLastSyncAt"


def _headers() -> dict[str, str]:
    return {"X-API-Key": get_settings().bedolaga_api_key}


async def sync_transactions(db: Session) -> int:
    """Paginate newest-first from offset 0, upserting every row, until
    either a page comes back short (reached the true end — this is what
    makes the very first run a full backfill) or we hit a transaction id
    already stored locally (steady-state incremental syncs stop fast).
    `total` in the API response is not trustworthy — it returned 1 on every
    page during testing regardless of actual volume, so it's never used
    here as a stopping condition."""
    settings = get_settings()
    base_url = settings.bedolaga_api_url_clean
    if not base_url or not settings.bedolaga_api_key:
        return 0

    synced_count = 0
    try:
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
            for page in range(TRANSACTIONS_MAX_PAGES):
                response = await client.get(
                    f"{base_url}/transactions",
                    params={"limit": PAGE_LIMIT, "offset": page * PAGE_LIMIT},
                    headers=_headers(),
                )
                if response.is_error:
                    raise RuntimeError(f"Bedolaga API HTTP {response.status_code}")
                data = response.json()
                items = data.get("items") if isinstance(data.get("items"), list) else []
                if not items:
                    break

                hit_known_id = False
                for item in items:
                    transaction_id = item.get("id")
                    if transaction_id is None:
                        continue
                    if db.get(models.BedolagaTransaction, transaction_id) is not None:
                        hit_known_id = True
                        continue
                    db.add(_transaction_from_api(item))
                    synced_count += 1
                db.commit()

                if hit_known_id or len(items) < PAGE_LIMIT:
                    break

        if synced_count:
            highest_id = db.scalar(select(func.max(models.BedolagaTransaction.id))) or 0
            set_meta(db, LAST_TRANSACTION_ID_KEY, str(highest_id))
        set_meta(db, LAST_SYNC_AT_KEY, now_iso())
        db.commit()
    except Exception as error:  # noqa: BLE001 - a failed sync must leave existing data untouched, never raise
        # A failed flush/commit leaves the session in "pending rollback"
        # state — any further use of `db` (even by the caller, after this
        # function returns) would raise a second, unrelated-looking error
        # on top of the real one unless the transaction is explicitly
        # cleared here.
        db.rollback()
        logger.warning("Bedolaga transaction sync failed: %s", error)
    return synced_count


def _transaction_from_api(item: dict) -> models.BedolagaTransaction:
    return models.BedolagaTransaction(
        id=item["id"],
        user_id=item.get("user_id"),
        type=str(item.get("type") or ""),
        amount_kopeks=int(item.get("amount_kopeks") or 0),
        payment_method=item.get("payment_method"),
        description=str(item.get("description") or ""),
        is_completed=1 if item.get("is_completed") else 0,
        created_at=str(item.get("created_at") or ""),
        completed_at=item.get("completed_at"),
        synced_at=now_iso(),
    )


async def _fetch_all_pages(client: httpx.AsyncClient, url: str, wrapped: bool) -> list[dict]:
    items: list[dict] = []
    offset = 0
    while True:
        response = await client.get(url, params={"limit": PAGE_LIMIT, "offset": offset}, headers=_headers())
        if response.is_error:
            raise RuntimeError(f"Bedolaga API HTTP {response.status_code} for {url}")
        data = response.json()
        if wrapped:
            page = data.get("items") if isinstance(data.get("items"), list) else []
        else:
            page = data if isinstance(data, list) else []
        items.extend(page)
        if len(page) < PAGE_LIMIT:
            break
        offset += PAGE_LIMIT
    return items


async def sync_subscriptions_and_users(db: Session) -> tuple[int, int]:
    """Current-state sync (no incremental shortcut — subscriptions and
    users can change in place, so every run refetches everything), followed
    by a daily rollup of subscriber counts by (status, is_trial) — the only
    place subscriber-count history survives, since the subscriptions table
    itself is overwritten to current-state on every run."""
    settings = get_settings()
    base_url = settings.bedolaga_api_url_clean
    if not base_url or not settings.bedolaga_api_key:
        return 0, 0

    subscriptions_synced = 0
    users_synced = 0
    try:
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
            subscriptions = await _fetch_all_pages(client, f"{base_url}/subscriptions", wrapped=False)
            users = await _fetch_all_pages(client, f"{base_url}/users", wrapped=True)

        for item in subscriptions:
            subscription_id = item.get("id")
            if subscription_id is None:
                continue
            row = db.get(models.BedolagaSubscription, subscription_id)
            if row is None:
                row = models.BedolagaSubscription(id=subscription_id)
                db.add(row)
            _apply_subscription_fields(row, item)
            subscriptions_synced += 1
        db.commit()

        for item in users:
            user_id = item.get("id")
            if user_id is None:
                continue
            row = db.get(models.BedolagaUser, user_id)
            if row is None:
                row = models.BedolagaUser(id=user_id)
                db.add(row)
            _apply_user_fields(row, item)
            users_synced += 1
        db.commit()

        _rollup_subscription_daily(db)
        set_meta(db, LAST_SYNC_AT_KEY, now_iso())
        db.commit()
    except Exception as error:  # noqa: BLE001 - a failed sync must leave existing data untouched, never raise
        db.rollback()  # see the matching comment in sync_transactions()
        logger.warning("Bedolaga subscriptions/users sync failed: %s", error)
    return subscriptions_synced, users_synced


def _apply_subscription_fields(row: models.BedolagaSubscription, item: dict) -> None:
    row.user_id = item.get("user_id")
    row.status = str(item.get("status") or "")
    row.actual_status = str(item.get("actual_status") or "")
    row.is_trial = 1 if item.get("is_trial") else 0
    row.start_date = str(item.get("start_date") or "")
    row.end_date = str(item.get("end_date") or "")
    row.traffic_limit_gb = float(item.get("traffic_limit_gb") or 0)
    row.traffic_used_gb = float(item.get("traffic_used_gb") or 0)
    row.device_limit = int(item.get("device_limit") or 0)
    row.autopay_enabled = 1 if item.get("autopay_enabled") else 0
    row.created_at = str(item.get("created_at") or "")
    row.updated_at = str(item.get("updated_at") or "")
    row.synced_at = now_iso()


def _apply_user_fields(row: models.BedolagaUser, item: dict) -> None:
    row.telegram_id = item.get("telegram_id")
    row.referred_by_id = item.get("referred_by_id")
    row.has_had_paid_subscription = 1 if item.get("has_had_paid_subscription") else 0
    row.created_at = str(item.get("created_at") or "")
    row.synced_at = now_iso()


def _rollup_subscription_daily(db: Session) -> None:
    today = datetime.now().strftime("%Y-%m-%d")
    counts = db.execute(
        select(models.BedolagaSubscription.status, models.BedolagaSubscription.is_trial, func.count())
        .group_by(models.BedolagaSubscription.status, models.BedolagaSubscription.is_trial)
    ).all()
    for status, is_trial, count in counts:
        row = db.get(models.BedolagaSubscriptionDaily, (today, status, is_trial))
        if row is None:
            row = models.BedolagaSubscriptionDaily(date=today, status=status, is_trial=is_trial)
            db.add(row)
        row.count = count
