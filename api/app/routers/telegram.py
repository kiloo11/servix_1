"""Telegram test endpoints — /api/telegram/test, /api/telegram/monthly-report/test."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from typing import Any

from app.core.bot_revenue import fetch_bot_revenue, get_bot_revenue_for_month, month_key_of
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import require_user
from app.core.locale import t
from app.core.meta import get_meta
from app.core.money import get_expense_for_month
from app.core.notify_text import monthly_report_text
from app.core.scheduler import previous_month_date, send_telegram_message

router = APIRouter(prefix="/api/telegram", tags=["telegram"], dependencies=[Depends(require_user)])


class TestBody(BaseModel):
    model_config = ConfigDict(extra="allow")

    def dict_(self) -> dict[str, Any]:
        return self.model_dump()


@router.post("/test")
async def telegram_test(body: TestBody, db: Session = Depends(get_db)):
    data = body.dict_()
    meta = get_meta(db)
    locale = meta.get("locale") or "ru"
    notify_url = None
    if "telegramNotifyUrl" in data:
        notify_url = str(data.get("telegramNotifyUrl") or "").strip()
    result = await send_telegram_message(t(locale, "alerts.testMessage"), db, notify_url=notify_url)
    return {"ok": True, "skipped": bool(result.get("skipped")), "reason": result.get("reason") or ""}


@router.post("/monthly-report/test")
async def telegram_monthly_report_test(db: Session = Depends(get_db)):
    import datetime as dt

    meta = get_meta(db)
    locale = meta.get("locale") or "ru"
    month_date = previous_month_date(dt.datetime.now())
    month_key = month_key_of(month_date)
    settings = get_settings()
    if settings.bedolaga_api_url_clean and settings.bedolaga_api_key:
        await fetch_bot_revenue(db, force=True)
    income_rub = get_bot_revenue_for_month(db, month_key)
    expense_rub = get_expense_for_month(db, month_key, meta)
    result = await send_telegram_message(monthly_report_text(income_rub, expense_rub, month_date, locale), db)
    return {"ok": True, "skipped": bool(result.get("skipped")), "reason": result.get("reason") or ""}
