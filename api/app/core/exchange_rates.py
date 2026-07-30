"""EUR-pivot exchange rate refresh — ported from server.js's
refreshExchangeRates(), same source (open.er-api.com) and same fields.
"""

from __future__ import annotations

import logging

import httpx
from sqlalchemy.orm import Session

from app.core.dates import now_iso
from app.core.meta import set_meta

logger = logging.getLogger(__name__)

EXCHANGE_RATE_URL = "https://open.er-api.com/v6/latest/EUR"
FETCH_TIMEOUT_SECONDS = 10
EXCHANGE_RATE_INTERVAL_SECONDS = 6 * 60 * 60


async def refresh_exchange_rates(db: Session) -> None:
    try:
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
            response = await client.get(EXCHANGE_RATE_URL)
        response.raise_for_status()
        data = response.json()
        rates = data.get("rates") or {}
        rub = _finite_positive(rates.get("RUB"))
        usd = _finite_positive(rates.get("USD"))
        if rub is not None:
            set_meta(db, "rateRubPerEur", rub)
        if usd is not None:
            set_meta(db, "rateUsdtPerEur", usd)
        if rub is not None or usd is not None:
            set_meta(db, "rateUpdatedAt", now_iso())
        db.commit()
    except Exception as error:  # noqa: BLE001 - matches server.js's catch-and-warn, never fatal
        logger.warning("Exchange rate refresh failed: %s", error)


def _finite_positive(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None
