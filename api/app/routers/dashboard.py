"""Dashboard metrics endpoints — read-only aggregations over Phase 2's
synced Bedolaga data + existing infra expenses. See app/core/dashboard_metrics.py
for the actual computation logic."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.core.dashboard_metrics import (
    arpu,
    bookings_mrr_by_month,
    cash_revenue_by_month,
    churn_rate,
    gross_margin,
    infra_cost_per_subscriber,
    month_bounds,
    mrr_movement,
    next_month,
    prev_month,
    recognized_mrr_by_month,
)
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import require_user
from app.core.forecasting import forecast_metric
from app.core.meta import get_meta
from app.core.money import get_expense_for_month

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(require_user)])


def _current_month() -> str:
    return datetime.now().strftime("%Y-%m")


def _summary_metrics(db: Session, target_month: str) -> dict:
    return {
        "cashRevenue": cash_revenue_by_month(db, target_month),
        "bookingsMrr": bookings_mrr_by_month(db, target_month),
        "recognizedMrr": recognized_mrr_by_month(db, target_month),
        "arpu": arpu(db, target_month),
        "grossMargin": gross_margin(db, target_month),
        "infraCostPerSubscriber": infra_cost_per_subscriber(db, target_month),
        "churnRate": churn_rate(db, target_month),
    }


@router.get("/summary")
def summary(month: str | None = None, db: Session = Depends(get_db)):
    target_month = month or _current_month()
    settings = get_settings()
    return {
        "month": target_month,
        # Every metric below is a pure aggregation over the bedolaga_* tables,
        # which stay empty until BEDOLAGA_API_URL/BEDOLAGA_API_KEY are set and
        # a sync has actually run — without this flag the frontend can't tell
        # "genuinely zero" apart from "integration not configured yet".
        "configured": bool(settings.bedolaga_api_url_clean and settings.bedolaga_api_key),
        **_summary_metrics(db, target_month),
        # Previous month's same metrics, so the frontend can render a trend
        # tag next to each card without a second round trip.
        "previous": _summary_metrics(db, prev_month(target_month)),
    }


@router.get("/mrr-movement")
def movement(month: str | None = None, db: Session = Depends(get_db)):
    target_month = month or _current_month()
    return {"month": target_month, "buckets": mrr_movement(db, target_month)}


def _active_subscribers_at_month_end(db: Session, month: str) -> int | None:
    _, month_end_exclusive, _ = month_bounds(month)
    cutoff = (month_end_exclusive - timedelta(days=1)).isoformat()
    row = db.execute(
        select(models.BedolagaSubscriptionDaily.count)
        .where(
            models.BedolagaSubscriptionDaily.date <= cutoff,
            models.BedolagaSubscriptionDaily.status == "active",
            models.BedolagaSubscriptionDaily.is_trial == 0,
        )
        .order_by(models.BedolagaSubscriptionDaily.date.desc())
        .limit(1)
    ).first()
    return row[0] if row else None


@router.get("/trend")
def trend(months: int = 12, db: Session = Depends(get_db)):
    month = _current_month()
    series = []
    for _ in range(months):
        series.append(
            {
                "month": month,
                "cashRevenue": cash_revenue_by_month(db, month),
                "bookingsMrr": bookings_mrr_by_month(db, month),
                "recognizedMrr": recognized_mrr_by_month(db, month),
                "activeSubscribers": _active_subscribers_at_month_end(db, month),
            }
        )
        month = prev_month(month)
    series.reverse()
    return {"months": series}


@router.get("/forecast")
def forecast(metric: str = "bookingsMrr", months: int = 3, db: Session = Depends(get_db)):
    return forecast_metric(db, metric, months)


@router.get("/reports")
def reports(db: Session = Depends(get_db)):
    """Monthly financial + SaaS reports, computed on demand from the same
    per-month aggregations the Дашборд/P&L tabs already use — no snapshot is
    stored, so a month's numbers are always current as of whenever it's
    viewed. Only fully-elapsed months are listed; the in-progress current
    month never appears here (that's what the Дашборд tab is for). Months
    with no financial activity at all (no cash in, no cash out, no bookings,
    no deferred revenue) are skipped entirely — e.g. before Bedolaga was ever
    configured, or a quiet month between an asset's lumpy multi-month
    renewals — rather than listing a run of all-zero rows."""
    settings = get_settings()
    meta = get_meta(db)
    earliest_bedolaga = db.scalar(select(func.min(models.BedolagaTransaction.created_at)))
    earliest_payment = db.scalar(select(func.min(models.Payment.paid_at)))
    candidates = [value[:7] for value in (earliest_bedolaga, earliest_payment) if value]

    months: list[dict] = []
    if candidates:
        month = min(candidates)
        current = _current_month()
        while month < current:
            cash_revenue = cash_revenue_by_month(db, month)
            expense = get_expense_for_month(db, month, meta)
            bookings_mrr = bookings_mrr_by_month(db, month)
            recognized_mrr = recognized_mrr_by_month(db, month)
            if any(abs(value) > 0.005 for value in (cash_revenue, expense, bookings_mrr, recognized_mrr)):
                months.append(
                    {
                        "month": month,
                        "cashRevenue": cash_revenue,
                        "expense": expense,
                        "net": cash_revenue - expense,
                        "bookingsMrr": bookings_mrr,
                        "recognizedMrr": recognized_mrr,
                        "arpu": arpu(db, month),
                        "grossMargin": gross_margin(db, month),
                        "churnRate": churn_rate(db, month),
                    }
                )
            month = next_month(month)
        months.reverse()

    return {
        "configured": bool(settings.bedolaga_api_url_clean and settings.bedolaga_api_key),
        "months": months,
    }
