"""EUR-pivot currency conversion for the monthly Telegram report — ported
from server.js's convertAmount/convertToEurAmount/getExpenseForMonth.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models


def convert_to_eur_amount(amount, currency: str, meta: dict) -> float:
    value = float(amount or 0)
    if currency == "RUB":
        return value / (float(meta.get("rateRubPerEur")) or 100)
    if currency == "USDT":
        return value / (float(meta.get("rateUsdtPerEur")) or 1.08)
    return value


def convert_amount(amount, from_currency: str, to_currency: str, meta: dict) -> float:
    from_currency = from_currency or "USDT"
    if from_currency == to_currency:
        return float(amount or 0)
    eur = convert_to_eur_amount(amount, from_currency, meta)
    if to_currency == "EUR":
        return eur
    if to_currency == "RUB":
        return eur * (float(meta.get("rateRubPerEur")) or 100)
    if to_currency == "USDT":
        return eur * (float(meta.get("rateUsdtPerEur")) or 1.08)
    return eur


def get_expense_for_month(db: Session, month_key: str, meta: dict) -> float:
    rows = db.execute(
        select(models.Payment.amount, models.Payment.currency).where(
            func.substr(models.Payment.paid_at, 1, 7) == month_key
        )
    ).all()
    return sum(convert_amount(row.amount, row.currency, "RUB", meta) for row in rows)
