"""Dashboard metrics endpoints — read-only aggregations over Phase 2's
synced Bedolaga data + existing infra expenses. See app/core/dashboard_metrics.py
for the actual computation logic."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
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
    prev_month,
    recognized_mrr_by_month,
)
from app.core.db import get_db
from app.core.deps import require_user
from app.core.forecasting import forecast_metric

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(require_user)])


def _current_month() -> str:
    return datetime.now().strftime("%Y-%m")


@router.get("/summary")
def summary(month: str | None = None, db: Session = Depends(get_db)):
    target_month = month or _current_month()
    return {
        "month": target_month,
        "cashRevenue": cash_revenue_by_month(db, target_month),
        "bookingsMrr": bookings_mrr_by_month(db, target_month),
        "recognizedMrr": recognized_mrr_by_month(db, target_month),
        "arpu": arpu(db, target_month),
        "grossMargin": gross_margin(db, target_month),
        "infraCostPerSubscriber": infra_cost_per_subscriber(db, target_month),
        "churnRate": churn_rate(db, target_month),
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
