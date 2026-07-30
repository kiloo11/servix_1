"""Dashboard metrics — pure computation layer over Phase 2's synced Bedolaga
tables plus the existing payments/assets expense data. No new tables; every
function here just reads and aggregates what bedolaga_sync.py already wrote.

See the Phase 3 section of the plan for the full reasoning: the confirmed
revenue model (cash vs. subscription/MRR revenue), the duration-extraction
regex validated against all 711 real synced transactions, and why MRR
movement classification (new/expansion/contraction/churned/reactivated) is
amount-based rather than parsed from Bedolaga's free-text descriptions —
the amounts don't care if Bedolaga changes their Russian message wording.
"""

from __future__ import annotations

import re
from calendar import monthrange
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.core.meta import get_meta
from app.core.money import get_expense_for_month

# Matches both "N дней"/"N дн." (the vast majority of descriptions) and the
# English "(Nd)" format the "Gift: ..." transactions use. Validated against
# every unique real description in the Phase 2 sync: 65/73 matched, and the
# 8 unmatched were all ₽0 admin/lateral-move transactions where duration is
# moot anyway.
_DURATION_RE = re.compile(r"(\d+)\s*дн|\((\d+)d\)")

SUBSCRIPTION_TYPES = ("subscription_payment", "gift_payment")


def extract_duration_days(description: str) -> int | None:
    match = _DURATION_RE.search(description or "")
    if not match:
        return None
    return int(match.group(1) or match.group(2))


def monthly_equivalent(amount_rubles: float, duration_days: int | None) -> float:
    days = duration_days or 30
    return amount_rubles / (days / 30)


def month_bounds(month: str) -> tuple[date, date, int]:
    """month = 'YYYY-MM' -> (first day, first day of next month, days in month)."""
    year, mon = int(month[:4]), int(month[5:7])
    days_in_month = monthrange(year, mon)[1]
    start = date(year, mon, 1)
    return start, start + timedelta(days=days_in_month), days_in_month


def prev_month(month: str) -> str:
    year, mon = int(month[:4]), int(month[5:7])
    if mon == 1:
        return f"{year - 1}-12"
    return f"{year}-{mon - 1:02d}"


def next_month(month: str) -> str:
    year, mon = int(month[:4]), int(month[5:7])
    if mon == 12:
        return f"{year + 1}-01"
    return f"{year}-{mon + 1:02d}"


def cash_revenue_by_month(db: Session, month: str) -> float:
    """Real money in: deposits via the real payment channel only — excludes
    registration bonuses (payment_method NULL) and the unconfirmed 'manual'
    method, per the confirmed revenue model."""
    rows = db.scalars(
        select(models.BedolagaTransaction).where(
            models.BedolagaTransaction.type == "deposit",
            models.BedolagaTransaction.payment_method == "platega",
            func.substr(models.BedolagaTransaction.created_at, 1, 7) == month,
        )
    ).all()
    return sum(row.amount_kopeks / 100 for row in rows)


def monthly_spend_by_user(db: Session, month: str) -> dict[int, float]:
    """Each user's normalized (duration-adjusted) subscription spend for one
    month — the shared per-user building block for MRR and its movement."""
    rows = db.execute(
        select(
            models.BedolagaTransaction.user_id,
            models.BedolagaTransaction.amount_kopeks,
            models.BedolagaTransaction.description,
        ).where(
            models.BedolagaTransaction.type.in_(SUBSCRIPTION_TYPES),
            func.substr(models.BedolagaTransaction.created_at, 1, 7) == month,
        )
    ).all()
    result: dict[int, float] = {}
    for user_id, amount_kopeks, description in rows:
        amount_rubles = abs(amount_kopeks) / 100
        duration = extract_duration_days(description)
        result[user_id] = result.get(user_id, 0.0) + monthly_equivalent(amount_rubles, duration)
    return result


def bookings_mrr_by_month(db: Session, month: str) -> float:
    """Normalized monthly-equivalent value of payments received in `month`,
    attributed entirely to that month regardless of how many months the
    subscription period actually covers. Simple, fast, no month-spreading."""
    return sum(monthly_spend_by_user(db, month).values())


def recognized_mrr_by_month(db: Session, month: str) -> float:
    """Deferred-revenue-style view: every subscription/gift payment's
    normalized value is prorated by day-count across every calendar month
    its period actually overlaps, not just credited to the payment month.
    A 360-day July payment keeps contributing (proportionally) through the
    following June."""
    month_start, month_end, days_in_month = month_bounds(month)

    rows = db.execute(
        select(
            models.BedolagaTransaction.amount_kopeks,
            models.BedolagaTransaction.description,
            models.BedolagaTransaction.completed_at,
            models.BedolagaTransaction.created_at,
        ).where(models.BedolagaTransaction.type.in_(SUBSCRIPTION_TYPES))
    ).all()

    total = 0.0
    for amount_kopeks, description, completed_at, created_at in rows:
        timestamp = completed_at or created_at
        if not timestamp:
            continue
        try:
            start_date = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).date()
        except ValueError:
            continue
        duration = extract_duration_days(description) or 30
        end_date = start_date + timedelta(days=duration)  # exclusive

        overlap_start = max(start_date, month_start)
        overlap_end = min(end_date, month_end)
        overlap_days = (overlap_end - overlap_start).days
        if overlap_days <= 0:
            continue

        amount_rubles = abs(amount_kopeks) / 100
        total += monthly_equivalent(amount_rubles, duration) * (overlap_days / days_in_month)
    return total


def mrr_movement(db: Session, month: str) -> dict[str, dict]:
    """Amount-based cohort comparison against the previous month, bucketed
    into the standard SaaS movement categories. `reactivated` (not just
    `new`) requires a short lookback further back than just the immediately
    previous month, to tell "came back after churning" apart from
    "genuinely new this month"."""
    current = monthly_spend_by_user(db, month)
    previous = monthly_spend_by_user(db, prev_month(month))

    lookback_month = prev_month(prev_month(month))
    ever_spent_before_prev: set[int] = set()
    for _ in range(5):
        ever_spent_before_prev.update(monthly_spend_by_user(db, lookback_month))
        lookback_month = prev_month(lookback_month)

    buckets: dict[str, list[int]] = {"new": [], "expansion": [], "contraction": [], "churned": [], "reactivated": [], "retained": []}
    for user_id in set(current) | set(previous):
        cur = current.get(user_id, 0.0)
        prev = previous.get(user_id, 0.0)
        if prev == 0 and cur > 0:
            buckets["reactivated" if user_id in ever_spent_before_prev else "new"].append(user_id)
        elif prev > 0 and cur == 0:
            buckets["churned"].append(user_id)
        elif cur > prev:
            buckets["expansion"].append(user_id)
        elif cur < prev:
            buckets["contraction"].append(user_id)
        else:
            buckets["retained"].append(user_id)

    result: dict[str, dict] = {}
    for bucket, user_ids in buckets.items():
        revenue_source = previous if bucket == "churned" else current
        result[bucket] = {
            "count": len(user_ids),
            "revenue": sum(revenue_source.get(uid, 0.0) for uid in user_ids),
            "userIds": user_ids,  # useful both for tests and a future "who churned" drill-down
        }
    return result


def churn_rate(db: Session, month: str) -> float:
    previous = monthly_spend_by_user(db, prev_month(month))
    if not previous:
        return 0.0
    return mrr_movement(db, month)["churned"]["count"] / len(previous)


def trial_conversion_rate(db: Session, cohort_month: str) -> float:
    rows = db.scalars(
        select(models.BedolagaUser).where(func.substr(models.BedolagaUser.created_at, 1, 7) == cohort_month)
    ).all()
    if not rows:
        return 0.0
    converted = sum(1 for row in rows if row.has_had_paid_subscription)
    return converted / len(rows)


def arpu(db: Session, month: str) -> float:
    spend = monthly_spend_by_user(db, month)
    if not spend:
        return 0.0
    return sum(spend.values()) / len(spend)


def gross_margin(db: Session, month: str) -> float:
    revenue = bookings_mrr_by_month(db, month)
    if revenue == 0:
        return 0.0
    expense = get_expense_for_month(db, month, get_meta(db))
    return (revenue - expense) / revenue


def infra_cost_per_subscriber(db: Session, month: str) -> float:
    subscriber_count = len(monthly_spend_by_user(db, month))
    if subscriber_count == 0:
        return 0.0
    expense = get_expense_for_month(db, month, get_meta(db))
    return expense / subscriber_count
