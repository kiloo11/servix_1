"""`meta` key/value table — site config that's seeded from env vars once,
then lives in the DB and is edited from Settings (same as server.js's
getMeta/setMeta/ensureMeta/normalize* family).
"""

from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_app_version, get_settings
from app import models

CURRENCIES = ["USDT", "EUR", "RUB"]


def ensure_meta(db: Session, key: str, value: str) -> None:
    if db.get(models.Meta, key) is None:
        db.add(models.Meta(key=key, value=str(value)))


def set_meta(db: Session, key: str, value) -> None:
    row = db.get(models.Meta, key)
    if row:
        row.value = str(value)
    else:
        db.add(models.Meta(key=key, value=str(value)))


def _meta_dict(db: Session) -> dict[str, str]:
    return {row.key: row.value for row in db.scalars(select(models.Meta))}


def normalize_currency(value: str | None) -> str:
    currency = (value or "").strip().upper()
    return currency if currency in CURRENCIES else "USDT"


def normalize_rate(value, fallback: float) -> float:
    try:
        rate = float(value)
    except (TypeError, ValueError):
        return fallback
    return rate if rate > 0 else fallback


def normalize_timezone(value: str | None) -> str:
    settings = get_settings()
    tz_name = (value or settings.app_timezone).strip() or settings.app_timezone
    try:
        ZoneInfo(tz_name)
        return tz_name
    except ZoneInfoNotFoundError as error:
        raise ValueError("Invalid timezone") from error


def get_meta(db: Session) -> dict:
    raw = _meta_dict(db)
    settings = get_settings()
    return {
        "version": get_app_version(),
        "siteTitle": raw.get("siteTitle") or settings.site_title,
        "notificationLeads": raw.get("notificationLeads") or "5m,2h,1d,3d,5d",
        "locale": raw.get("locale") if raw.get("locale") in ("ru", "en") else "ru",
        "timezone": normalize_timezone(raw.get("timezone") or settings.app_timezone),
        "telegramNotifyUrl": raw.get("telegramNotifyUrl") or "",
        "notifyOnStart": str(raw.get("notifyOnStart", "true")) == "true",
        "telegramConfigured": bool(raw.get("telegramNotifyUrl") or settings.telegram_notify_url),
        "currency": normalize_currency(raw.get("currency")),
        "rateRubPerEur": normalize_rate(raw.get("rateRubPerEur"), 100),
        "rateUsdtPerEur": normalize_rate(raw.get("rateUsdtPerEur"), 1.08),
        "rateUpdatedAt": raw.get("rateUpdatedAt") or "",
    }


def get_public_meta(db: Session) -> dict:
    meta = get_meta(db)
    return {
        "version": meta["version"],
        "siteTitle": meta["siteTitle"],
        "locale": meta["locale"],
        "timezone": meta["timezone"],
        "currency": meta["currency"],
    }


def init_meta_defaults(db: Session) -> None:
    settings = get_settings()
    ensure_meta(db, "siteTitle", settings.site_title)
    ensure_meta(db, "notificationLeads", "5m,2h,1d,3d,5d")
    ensure_meta(db, "locale", "ru")
    ensure_meta(db, "timezone", normalize_timezone(settings.app_timezone))
    ensure_meta(db, "telegramNotifyUrl", settings.telegram_notify_url)
    ensure_meta(db, "notifyOnStart", str(settings.notify_on_start).lower())
    ensure_meta(db, "currency", "USDT")
    ensure_meta(db, "rateRubPerEur", "100")
    ensure_meta(db, "rateUsdtPerEur", "1.08")
    ensure_meta(db, "rateUpdatedAt", "")
    db.commit()
