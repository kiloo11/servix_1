"""Revenue forecasting — OLS linear trend over Phase 3's monthly metrics,
not Prophet/seasonal ARIMA. See the Phase 4 section of the plan for why:
only ~5 months of real history exist, nowhere near enough for seasonal
modeling to mean anything, and Prophet's dependency weight (matplotlib,
Pillow, a C++ Stan toolchain) isn't justified by the data volume anyway.

Deliberately simple and upgradable: once 12+ months of real data exist,
swap in something like Holt-Winters without changing the API contract —
callers only see {history, forecast, confidence}.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

import numpy as np
import statsmodels.api as sm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.core.dashboard_metrics import (
    bookings_mrr_by_month,
    cash_revenue_by_month,
    next_month,
    recognized_mrr_by_month,
)

MIN_DATA_POINTS = 3  # below this, an OLS confidence interval isn't meaningful (needs n>=3 residual df)
CONFIDENCE_INTERVAL_ALPHA = 0.20  # 80% interval — a conventional 95% is uninformatively wide at n~5

METRIC_FUNCTIONS = {
    "cashRevenue": cash_revenue_by_month,
    "bookingsMrr": bookings_mrr_by_month,
    "recognizedMrr": recognized_mrr_by_month,
}


def _history_months(db: Session) -> list[str]:
    earliest = db.scalar(select(func.min(models.BedolagaTransaction.created_at)))
    current_month = datetime.now().strftime("%Y-%m")
    if not earliest:
        return [current_month]
    month = earliest[:7]
    months = [month]
    while month < current_month:
        month = next_month(month)
        months.append(month)
    return months


def _confidence_label(data_points: int) -> str:
    if data_points < MIN_DATA_POINTS:
        return "insufficient"
    if data_points < 6:
        return "low"
    if data_points < 12:
        return "medium"
    return "high"


def forecast_metric(
    db: Session,
    metric: Literal["cashRevenue", "bookingsMrr", "recognizedMrr"],
    months_ahead: int = 3,
) -> dict:
    if metric not in METRIC_FUNCTIONS:
        raise ValueError(f"Unknown metric '{metric}' — expected one of {sorted(METRIC_FUNCTIONS)}")

    metric_fn = METRIC_FUNCTIONS[metric]
    months = _history_months(db)
    history = [{"month": m, "value": metric_fn(db, m)} for m in months]

    if len(history) < MIN_DATA_POINTS:
        return {"metric": metric, "dataPointsUsed": len(history), "confidence": "insufficient", "history": history, "forecast": []}

    y = np.array([row["value"] for row in history])
    x = np.arange(len(history))
    model = sm.OLS(y, sm.add_constant(x)).fit()

    future_x = np.arange(len(history), len(history) + months_ahead)
    prediction = model.get_prediction(sm.add_constant(future_x, has_constant="add"))
    summary = prediction.summary_frame(alpha=CONFIDENCE_INTERVAL_ALPHA)

    forecast = []
    month = months[-1]
    for i in range(months_ahead):
        month = next_month(month)
        row = summary.iloc[i]
        forecast.append(
            {
                "month": month,
                "value": max(0.0, float(row["mean"])),
                "lower": max(0.0, float(row["obs_ci_lower"])),
                "upper": max(0.0, float(row["obs_ci_upper"])),
            }
        )

    return {
        "metric": metric,
        "dataPointsUsed": len(history),
        "confidence": _confidence_label(len(history)),
        "history": history,
        "forecast": forecast,
    }
