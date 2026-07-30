"""Dashboard metrics — duration extraction against the real description
categories found in the Phase 2 sync, MRR movement bucket classification,
and the recognized-MRR day-proration math.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app import models
from app.core import dashboard_metrics as dm

# Years far in the future and a dedicated id range, so this file's rows
# never collide with other tests sharing the same session-scoped temp DB.
YEAR = 2030


@pytest.mark.parametrize(
    "description,expected",
    [
        ("Покупка тарифа '📄 Премиум' на 30 дней", 30),
        ("Автопродление подписки на 30 дней", 30),
        ("Автопродление истёкшей подписки на 30 дней", 30),
        ("Переход на тариф '📄 Премиум' (доплата за 26 дней)", 26),
        ("Подписка на 360 дней (12 мес)", 360),
        ("Gift: 📱 Стандартный (30d)", 30),
        ("Смена тарифа администратором на 'X'", None),  # admin change, ₽0, no duration marker
    ],
)
def test_extract_duration_days(description, expected):
    assert dm.extract_duration_days(description) == expected


def test_monthly_equivalent_normalizes_long_periods():
    # A 360-day, 3897.6-rouble payment should normalize to ~1/12th per month
    assert dm.monthly_equivalent(3897.6, 360) == pytest.approx(324.8, abs=0.1)
    # No duration info (None) falls back to 30 days -> unchanged
    assert dm.monthly_equivalent(100.0, None) == pytest.approx(100.0)


def _tx(id_, user_id, month: str, amount_rubles: float, days: int = 30, day: int = 15):
    return models.BedolagaTransaction(
        id=id_,
        user_id=user_id,
        type="subscription_payment",
        amount_kopeks=-round(amount_rubles * 100),
        payment_method="balance",
        description=f"Подписка на {days} дней",
        is_completed=1,
        created_at=f"{month}-{day:02d}T00:00:00Z",
        completed_at=f"{month}-{day:02d}T00:00:01Z",
        synced_at="x",
    )


def test_mrr_movement_buckets(db):
    curr, prev = f"{YEAR}-06", f"{YEAR}-05"
    reactivation_month = f"{YEAR}-02"  # within the 5-month lookback before `prev`

    db.add_all([
        _tx(90001, 1001, curr, 100),  # new: nothing before, something now
        _tx(90002, 1002, prev, 100), _tx(90003, 1002, curr, 200),  # expansion
        _tx(90004, 1003, prev, 200), _tx(90005, 1003, curr, 100),  # contraction
        _tx(90006, 1004, prev, 150),  # churned: nothing this month
        _tx(90007, 1005, reactivation_month, 100), _tx(90008, 1005, curr, 120),  # reactivated
        _tx(90009, 1006, prev, 100), _tx(90010, 1006, curr, 100),  # retained
    ])
    db.commit()

    result = dm.mrr_movement(db, curr)

    assert 1001 in result["new"]["userIds"]
    assert 1002 in result["expansion"]["userIds"]
    assert 1003 in result["contraction"]["userIds"]
    assert 1004 in result["churned"]["userIds"]
    assert 1005 in result["reactivated"]["userIds"]
    assert 1006 in result["retained"]["userIds"]

    assert result["expansion"]["revenue"] >= 200  # includes user 1002's 200 among possibly others
    assert result["churned"]["revenue"] >= 150  # lost revenue is the *previous* month's spend


def test_recognized_mrr_sums_to_full_value_across_overlapped_months(db):
    amount = 900.0
    duration = 60
    start = date(YEAR, 8, 1)  # deliberately clear of the 02/05/06 months test_mrr_movement_buckets uses
    db.add(models.BedolagaTransaction(
        id=90100, user_id=2001, type="subscription_payment", amount_kopeks=-90000,
        payment_method="balance", description=f"Подписка на {duration} дней", is_completed=1,
        created_at=f"{start.isoformat()}T00:00:00Z", completed_at=f"{start.isoformat()}T00:00:01Z", synced_at="x",
    ))
    db.commit()

    end = start + timedelta(days=duration)
    months = sorted({(start.year, start.month), (end.year, end.month)} | {
        (d.year, d.month) for d in (start + timedelta(days=n) for n in range(duration))
    })
    total = sum(dm.recognized_mrr_by_month(db, f"{y}-{m:02d}") for y, m in months)

    # Summed across every overlapped month, the day-prorated recognized
    # value converges to the actual amount paid (not the monthly *rate* —
    # that's monthly_equivalent(), a different number). Real calendar
    # months don't divide evenly into 30-day chunks, so this is "close to"
    # `amount`, not exact — a few percent of slop is expected, not a bug.
    assert total == pytest.approx(amount, rel=0.05)


def test_cash_revenue_excludes_bonuses_and_non_platega(db):
    month = f"{YEAR}-09"
    db.add_all([
        models.BedolagaTransaction(
            id=90200, user_id=3001, type="deposit", amount_kopeks=10000, payment_method="platega",
            description="Пополнение через Platega", is_completed=1,
            created_at=f"{month}-01T00:00:00Z", completed_at=f"{month}-01T00:00:01Z", synced_at="x",
        ),
        models.BedolagaTransaction(
            id=90201, user_id=3002, type="deposit", amount_kopeks=10000, payment_method=None,
            description="Бонус за регистрацию", is_completed=1,
            created_at=f"{month}-02T00:00:00Z", completed_at=None, synced_at="x",
        ),
        models.BedolagaTransaction(
            id=90202, user_id=3003, type="deposit", amount_kopeks=10000, payment_method="manual",
            description="Начисление админом", is_completed=1,
            created_at=f"{month}-03T00:00:00Z", completed_at=None, synced_at="x",
        ),
    ])
    db.commit()

    assert dm.cash_revenue_by_month(db, month) == pytest.approx(100.0)  # only the platega one
