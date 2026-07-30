"""Bedolaga sync — pagination termination logic, daily rollup, and the
session-poisoning regression (a failed sync must leave the db session
usable afterward, not just "not raise").
"""

from __future__ import annotations

from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy import func, select

from app import models
from app.core import bedolaga_sync


@pytest.fixture(autouse=True)
def _configure_bedolaga(monkeypatch):
    """Every test in this file needs Bedolaga to look "configured" (real
    URL/key) without touching the global, lru_cache'd Settings singleton
    other tests rely on being unconfigured."""
    fake_settings = SimpleNamespace(bedolaga_api_url_clean="https://fake-bedolaga.test", bedolaga_api_key="fake-key")
    monkeypatch.setattr(bedolaga_sync, "get_settings", lambda: fake_settings)
    monkeypatch.setattr(bedolaga_sync, "PAGE_LIMIT", 3)


_RealAsyncClient = httpx.AsyncClient  # captured before any monkeypatching, to avoid the fake calling itself


def _patch_transport(monkeypatch, handler):
    def fake_async_client(*args, **kwargs):
        kwargs.pop("timeout", None)
        return _RealAsyncClient(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", fake_async_client)


def _transaction_item(id_, **overrides) -> dict:
    item = {
        "id": id_,
        "user_id": 1,
        "type": "deposit",
        "amount_kopeks": 10000,
        "amount_rubles": 100.0,
        "description": "",
        "payment_method": "platega",
        "is_completed": True,
        "created_at": f"2026-07-{id_:02d}T00:00:00Z",
        "completed_at": f"2026-07-{id_:02d}T00:00:01Z",
    }
    item.update(overrides)
    return item


async def test_sync_transactions_stops_on_short_page(monkeypatch, db):
    calls = []

    async def handler(request: httpx.Request) -> httpx.Response:
        offset = int(request.url.params["offset"])
        calls.append(offset)
        if offset == 0:
            return httpx.Response(200, json={"items": [_transaction_item(i) for i in (5, 4, 3)], "total": 1})
        if offset == 3:
            return httpx.Response(200, json={"items": [_transaction_item(i) for i in (2, 1)], "total": 1})
        raise AssertionError(f"unexpected offset {offset}")

    _patch_transport(monkeypatch, handler)
    synced = await bedolaga_sync.sync_transactions(db)

    assert synced == 5
    assert calls == [0, 3]  # stopped after the short (2-item) page, no third request
    rows = db.scalars(select(models.BedolagaTransaction)).all()
    assert {1, 2, 3, 4, 5} <= {row.id for row in rows}


async def test_sync_transactions_stops_on_already_seen_id(monkeypatch, db):
    db.add(models.BedolagaTransaction(
        id=100, user_id=1, type="deposit", amount_kopeks=5000, payment_method="platega",
        description="", is_completed=1, created_at="2026-07-01T00:00:00Z", completed_at=None, synced_at="x",
    ))
    db.commit()

    calls = []

    async def handler(request: httpx.Request) -> httpx.Response:
        offset = int(request.url.params["offset"])
        calls.append(offset)
        # Full page (3 items) but the last one is already known -> must stop
        # here, never request a second page, even though this page is full.
        return httpx.Response(200, json={"items": [_transaction_item(i) for i in (103, 102, 100)], "total": 1})

    _patch_transport(monkeypatch, handler)
    synced = await bedolaga_sync.sync_transactions(db)

    assert synced == 2  # 103, 102 - not re-counting the already-known 100
    assert calls == [0]
    rows = db.scalars(select(models.BedolagaTransaction)).all()
    # superset, not equality: this table is shared across tests in this file
    assert {100, 102, 103} <= {row.id for row in rows}


async def test_sync_transactions_failure_leaves_db_usable(monkeypatch, db):
    count_before = db.scalar(select(func.count()).select_from(models.BedolagaTransaction))

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "boom"})

    _patch_transport(monkeypatch, handler)
    synced = await bedolaga_sync.sync_transactions(db)

    assert synced == 0
    # The real regression: a prior version left the session in "pending
    # rollback" state after a failed sync, so this next query would raise
    # instead of returning cleanly (this table is shared across tests in
    # this file, hence a before/after delta rather than expecting empty).
    count_after = db.scalar(select(func.count()).select_from(models.BedolagaTransaction))
    assert count_after == count_before


async def test_sync_transactions_not_configured_is_a_noop(monkeypatch, db):
    monkeypatch.setattr(bedolaga_sync, "get_settings", lambda: SimpleNamespace(bedolaga_api_url_clean="", bedolaga_api_key=""))
    synced = await bedolaga_sync.sync_transactions(db)
    assert synced == 0


def test_rollup_subscription_daily_groups_correctly(db):
    def sub(id_, status, is_trial):
        return models.BedolagaSubscription(
            id=id_, user_id=1, status=status, actual_status=status, is_trial=1 if is_trial else 0,
            start_date="2026-07-01T00:00:00Z", end_date="2026-08-01T00:00:00Z",
            traffic_limit_gb=10, traffic_used_gb=0, device_limit=1, autopay_enabled=0,
            created_at="2026-07-01T00:00:00Z", updated_at="2026-07-01T00:00:00Z", synced_at="x",
        )

    db.add_all([
        sub(1, "active", False),
        sub(2, "active", False),
        sub(3, "active", True),
        sub(4, "expired", False),
    ])
    db.commit()

    bedolaga_sync._rollup_subscription_daily(db)
    db.commit()

    from datetime import datetime

    today = datetime.now().strftime("%Y-%m-%d")
    rows = db.scalars(
        select(models.BedolagaSubscriptionDaily).where(models.BedolagaSubscriptionDaily.date == today)
    ).all()
    counts = {(row.status, row.is_trial): row.count for row in rows}
    assert counts == {("active", 0): 2, ("active", 1): 1, ("expired", 0): 1}

    # idempotent: running it again the same day must not duplicate rows,
    # just update the counts in place
    bedolaga_sync._rollup_subscription_daily(db)
    db.commit()
    rows_again = db.scalars(
        select(models.BedolagaSubscriptionDaily).where(models.BedolagaSubscriptionDaily.date == today)
    ).all()
    assert len(rows_again) == len(rows)
