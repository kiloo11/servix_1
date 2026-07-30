"""Forecasting — OLS trend direction/magnitude on synthetic linear data,
the MIN_DATA_POINTS guard, and the confidence-label thresholds.
"""

from __future__ import annotations

import pytest

from app import models
from app.core import forecasting as fc

# Dedicated year/id range so this file's rows never collide with other
# tests sharing the same session-scoped temp DB.
YEAR = 2031


@pytest.mark.parametrize(
    "n,expected",
    [(0, "insufficient"), (2, "insufficient"), (3, "low"), (5, "low"), (6, "medium"), (11, "medium"), (12, "high"), (24, "high")],
)
def test_confidence_label_thresholds(n, expected):
    assert fc._confidence_label(n) == expected


def _tx(id_, month: str, amount_rubles: float, day: int = 15):
    return models.BedolagaTransaction(
        id=id_, user_id=5001, type="subscription_payment", amount_kopeks=-round(amount_rubles * 100),
        payment_method="balance", description="Подписка на 30 дней", is_completed=1,
        created_at=f"{month}-{day:02d}T00:00:00Z", completed_at=f"{month}-{day:02d}T00:00:01Z", synced_at="x",
    )


def test_forecast_continues_a_clear_linear_trend(db, monkeypatch):
    # _history_months walks from the *real* earliest transaction to the
    # *real* current month — a future YEAR (2031) breaks that walk (the
    # loop's `while month < current_month` never runs since 2031 > "now"),
    # and even a past year would pull in whatever other test files already
    # planted in this shared table. Monkeypatching _history_months makes
    # this a deterministic, isolated test of the OLS fit itself.
    months = [f"{YEAR}-01", f"{YEAR}-02", f"{YEAR}-03", f"{YEAR}-04"]
    values = [100.0, 110.0, 120.0, 130.0]
    db.add_all([_tx(95000 + i, m, v) for i, (m, v) in enumerate(zip(months, values))])
    db.commit()
    monkeypatch.setattr(fc, "_history_months", lambda db: months)

    result = fc.forecast_metric(db, "bookingsMrr", months_ahead=2)

    assert result["confidence"] == "low"
    assert result["dataPointsUsed"] == 4
    assert len(result["forecast"]) == 2
    # continuing 100/110/120/130 -> next two points should keep climbing,
    # roughly 140/150
    first, second = result["forecast"]
    assert second["value"] > first["value"]
    assert first["value"] > values[-1]
    assert first["lower"] <= first["value"] <= first["upper"]


def test_forecast_insufficient_data_returns_empty_forecast(db, monkeypatch):
    # _history_months scans the *whole* bedolaga_transactions table, which
    # in this shared-fixture test DB already has >=3 months of history from
    # other test files by the time this runs — so the only way to exercise
    # the real MIN_DATA_POINTS guard branch is to control what
    # _history_months returns, not what's actually in the table.
    monkeypatch.setattr(fc, "_history_months", lambda db: ["2031-09", "2031-10"])

    result = fc.forecast_metric(db, "bookingsMrr")

    assert result["confidence"] == "insufficient"
    assert result["forecast"] == []
    assert result["dataPointsUsed"] == 2


def test_forecast_rejects_unknown_metric(db):
    with pytest.raises(ValueError):
        fc.forecast_metric(db, "notARealMetric")
