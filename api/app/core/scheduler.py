"""Telegram due-notification + monthly-report scheduling — ported from
server.js's scheduleNotifications/processDueNotifications/
scheduleMonthlyReport/sendMonthlyReport/getNotificationEvents/
pickNearestDueEvents/wasSent/markSent family.

server.js recomputes a raw setTimeout for "the next thing that needs to
happen" every time data changes or a run completes; APScheduler's one-shot
'date' trigger (replace_existing=True on a fixed job id) is the same
pattern without JS's ~24.8-day setTimeout ceiling to work around.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from app import models
from app.core import hooks
from app.core.bedolaga_sync import sync_subscriptions_and_users, sync_transactions
from app.core.bot_revenue import fetch_bot_revenue, get_bot_revenue_for_month, month_key_of
from app.core.config import get_settings
from app.core.dates import now_iso
from app.core.db import SessionLocal
from app.core.exchange_rates import EXCHANGE_RATE_INTERVAL_SECONDS, refresh_exchange_rates
from app.core.money import get_expense_for_month
from app.core.notify_text import alert_text, monthly_report_text, parse_app_date, type_label
from app.core.records import get_data
from app.core.update import UPDATE_CHECK_INTERVAL_SECONDS, check_for_update

logger = logging.getLogger(__name__)

NOTIFICATIONS_JOB_ID = "due-notifications"
MONTHLY_REPORT_JOB_ID = "monthly-report"
BEDOLAGA_TRANSACTIONS_JOB_ID = "bedolaga-transactions-sync"
BEDOLAGA_SUBSCRIPTIONS_JOB_ID = "bedolaga-subscriptions-sync"
EXCHANGE_RATE_JOB_ID = "exchange-rate-refresh"
UPDATE_CHECK_JOB_ID = "update-check"
BEDOLAGA_TRANSACTIONS_INTERVAL_SECONDS = 2 * 60 * 60
BEDOLAGA_SUBSCRIPTIONS_SYNC_HOUR = 3
BEDOLAGA_SUBSCRIPTIONS_SYNC_MINUTE = 30

scheduler = AsyncIOScheduler()


def telegram_notify_url(db: Session) -> str:
    from app.core.meta import get_meta

    settings = get_settings()
    meta = get_meta(db)
    return meta.get("telegramNotifyUrl") or settings.telegram_notify_url


def _parse_telegram_url(raw: str) -> dict | None:
    import re

    if not raw:
        return None
    match = re.match(r"^tgram://([^/]+)/([^:]+)(?::(.+))?$", raw)
    if not match:
        raise ValueError("TELEGRAM_NOTIFY_URL должен быть вида tgram://token/chat_id:topic")
    return {"token": match.group(1), "chatId": match.group(2), "topicId": match.group(3) or ""}


async def send_telegram_message(text: str, db: Session, notify_url: str | None = None, button_url: str | None = None, button_text: str | None = None) -> dict:
    config = _parse_telegram_url(notify_url if notify_url is not None else telegram_notify_url(db))
    if not config:
        return {"skipped": True, "reason": "Telegram URL не задан"}
    payload: dict = {"chat_id": config["chatId"], "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if config["topicId"]:
        payload["message_thread_id"] = int(config["topicId"])
    if button_url:
        payload["reply_markup"] = {"inline_keyboard": [[{"text": button_text or "Перейти к оплате", "url": button_url}]]}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"https://api.telegram.org/bot{config['token']}/sendMessage", json=payload)
    try:
        result = response.json()
    except ValueError:
        result = {}
    if response.is_error:
        raise RuntimeError(result.get("description") or "Telegram не принял сообщение")
    return result


def _event_id(asset: dict, lead: dict | None = None) -> str:
    suffix = f"-{lead['value']}" if lead else ""
    return f"{asset['id']}-expiresAt-{asset['expiresAt']}{suffix}"


def get_notification_events(db: Session) -> list[dict]:
    from app.core.dates import parse_duration_token
    from app.core.meta import get_meta

    meta = get_meta(db)
    leads_source = meta.get("notificationLeads") or "5m,2h,1d,3d,5d"
    parsed_leads = [lead for item in leads_source.split(",") if (lead := parse_duration_token(item.strip()))]
    unique_leads = list({lead["value"]: lead for lead in parsed_leads}.values())
    leads = sorted(unique_leads, key=lambda lead: lead["minutes"])

    data = get_data(db)
    events = []
    for asset in data["assets"]:
        if asset["inactive"]:
            continue
        expires = parse_app_date(asset["expiresAt"])
        if not expires:
            continue
        for lead in leads:
            trigger_at = expires - timedelta(minutes=lead["minutes"])
            events.append({"id": _event_id(asset, lead), "asset": asset, "lead": lead, "expires": expires, "triggerAt": trigger_at})
    events.sort(key=lambda event: event["triggerAt"])
    return events


def get_due_items(db: Session) -> list[dict]:
    """UI-facing "what's coming up" list for /api/notifications — independent
    of the Telegram-sent dedup state get_notification_events tracks, and
    (unlike it) also surfaces already-overdue items."""
    from app.core.dates import parse_duration_token
    from app.core.locale import t

    data = get_data(db)
    locale = data["meta"].get("locale") or "ru"
    leads_source = data["meta"].get("notificationLeads") or "5m,2h,1d,3d,5d"
    lead_minutes = [lead["minutes"] for item in leads_source.split(",") if (lead := parse_duration_token(item.strip()))]
    max_lead_minutes = max([*lead_minutes, 1])
    now = datetime.now()
    limit = now + timedelta(minutes=max_lead_minutes)

    items = []
    for asset in data["assets"]:
        if asset["inactive"]:
            continue
        value = parse_app_date(asset["expiresAt"])
        if not value or value > limit:
            continue
        minutes_left = math.ceil((value - now).total_seconds() / 60)
        items.append(
            {
                "id": _event_id(asset),
                "assetId": asset["id"],
                "type": "expiresAt",
                "date": asset["expiresAt"],
                "title": f"{type_label(asset['type'], locale)} {t(locale, 'common.expiresAt').lower()}: {asset['name']}",
                "daysLeft": math.ceil(minutes_left / 1440),
                "minutesLeft": minutes_left,
            }
        )
    items.sort(key=lambda item: str(item["date"]))
    return items


def was_sent(db: Session, event_id: str) -> bool:
    return db.get(models.TelegramSent, event_id) is not None


def mark_sent(db: Session, event_id: str) -> None:
    row = db.get(models.TelegramSent, event_id)
    if row is None:
        db.add(models.TelegramSent(event_id=event_id, sent_at=now_iso()))
    else:
        row.sent_at = now_iso()
    db.commit()


def _pick_nearest_due_events(events: list[dict], db: Session, now: datetime) -> list[dict]:
    by_asset: dict[str, dict] = {}
    for event in events:
        if event["triggerAt"] > now or was_sent(db, event["id"]):
            continue
        key = f"{event['asset']['id']}-{event['asset']['expiresAt']}"
        current = by_asset.get(key)
        if current is None:
            by_asset[key] = {**event, "suppressIds": [event["id"]]}
            continue
        current["suppressIds"].append(event["id"])
        if event["lead"]["minutes"] < current["lead"]["minutes"]:
            by_asset[key] = {**event, "suppressIds": current["suppressIds"]}
    return sorted(by_asset.values(), key=lambda event: event["triggerAt"])


async def _process_due_notifications(db: Session) -> None:
    notify_url = telegram_notify_url(db)
    if not notify_url:
        return
    now = datetime.now()
    data = get_data(db)
    locale = data["meta"].get("locale") or "ru"
    timezone = data["meta"].get("timezone") or "Europe/Moscow"
    provider_by_id = {provider["id"]: provider for provider in data["providers"]}
    events = get_notification_events(db)
    due_events = _pick_nearest_due_events(events, db, now)
    due = []
    for event in due_events:
        minutes_left = math.ceil((event["expires"] - now).total_seconds() / 60)
        asset = event["asset"]
        due.append(
            {
                "id": event["id"],
                "assetId": asset["id"],
                "asset": asset,
                "provider": provider_by_id.get(asset["providerId"]),
                "lead": event["lead"],
                "suppressIds": event["suppressIds"],
                "minutesLeft": minutes_left,
            }
        )
    for item in due:
        provider = item.get("provider")
        from app.core.locale import t

        result = await send_telegram_message(
            alert_text(item, locale, timezone),
            db,
            button_url=provider.get("loginUrl") if provider else None,
            button_text=t(locale, "telegram.paymentButton"),
        )
        if not result.get("skipped"):
            for event_id in item.get("suppressIds") or [item["id"]]:
                mark_sent(db, event_id)


def schedule_notifications() -> None:
    if scheduler.get_job(NOTIFICATIONS_JOB_ID):
        scheduler.remove_job(NOTIFICATIONS_JOB_ID)
    db = SessionLocal()
    try:
        if not telegram_notify_url(db):
            return
        now = datetime.now()
        events = get_notification_events(db)
        next_event = next((event for event in events if not was_sent(db, event["id"])), None)
        if next_event is None:
            return
        run_date = max(next_event["triggerAt"], now)
        # No misfire concept in Node's setTimeout — it always fires no matter
        # how late the event loop gets to it, so grace time is unbounded here.
        scheduler.add_job(
            _run_process_due_notifications,
            DateTrigger(run_date=run_date),
            id=NOTIFICATIONS_JOB_ID,
            replace_existing=True,
            misfire_grace_time=None,
        )
    finally:
        db.close()


async def _run_process_due_notifications() -> None:
    db = SessionLocal()
    try:
        await _process_due_notifications(db)
    except Exception as error:  # noqa: BLE001 - matches server.js's catch-and-reschedule
        logger.warning(str(error))
    finally:
        db.close()
    schedule_notifications()


def previous_month_date(from_date: datetime) -> datetime:
    year = from_date.year
    month = from_date.month - 1
    if month < 1:
        month = 12
        year -= 1
    return datetime(year, month, 1)


async def _send_monthly_report(db: Session) -> None:
    notify_url = telegram_notify_url(db)
    if not notify_url:
        return
    from app.core.meta import get_meta

    meta = get_meta(db)
    locale = meta.get("locale") or "ru"
    month_date = previous_month_date(datetime.now())
    month_key = month_key_of(month_date)
    settings = get_settings()
    if settings.bedolaga_api_url_clean and settings.bedolaga_api_key:
        await fetch_bot_revenue(db, force=True)
    income_rub = get_bot_revenue_for_month(db, month_key)
    expense_rub = get_expense_for_month(db, month_key, meta)
    await send_telegram_message(monthly_report_text(income_rub, expense_rub, month_date, locale), db)


def schedule_monthly_report() -> None:
    if scheduler.get_job(MONTHLY_REPORT_JOB_ID):
        scheduler.remove_job(MONTHLY_REPORT_JOB_ID)
    db = SessionLocal()
    try:
        if not telegram_notify_url(db):
            return
        now = datetime.now()
        next_run = datetime(now.year, now.month, 1, 9, 0, 0)
        if next_run <= now:
            next_month = now.month + 1
            next_year = now.year
            if next_month > 12:
                next_month = 1
                next_year += 1
            next_run = datetime(next_year, next_month, 1, 9, 0, 0)
        scheduler.add_job(
            _run_send_monthly_report,
            DateTrigger(run_date=next_run),
            id=MONTHLY_REPORT_JOB_ID,
            replace_existing=True,
            misfire_grace_time=None,
        )
    finally:
        db.close()


async def _run_send_monthly_report() -> None:
    db = SessionLocal()
    try:
        await _send_monthly_report(db)
    except Exception as error:  # noqa: BLE001 - matches server.js's catch-and-reschedule
        logger.warning(str(error))
    finally:
        db.close()
    schedule_monthly_report()


async def _run_bedolaga_transactions_sync() -> None:
    db = SessionLocal()
    try:
        await sync_transactions(db)  # never raises - failures are logged and existing data is left untouched
    finally:
        db.close()


async def _run_bedolaga_subscriptions_sync() -> None:
    db = SessionLocal()
    try:
        await sync_subscriptions_and_users(db)  # never raises, same reasoning as above
    finally:
        db.close()


async def _run_exchange_rate_refresh() -> None:
    db = SessionLocal()
    try:
        await refresh_exchange_rates(db)  # never raises - catches and warns internally
    finally:
        db.close()


async def _run_update_check() -> None:
    await check_for_update(True)  # never raises - failures are recorded on the status object


def init_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
    hooks.register_on_asset_changed(schedule_notifications)
    schedule_notifications()
    schedule_monthly_report()

    # Recurring interval jobs — server.js ran these via setInterval() after
    # the initial startup call; that periodic re-run was never actually
    # wired into the Python port until now (only the one-shot startup call
    # in main.py existed), which meant rates/update-checks silently went
    # stale forever after the process started.
    scheduler.add_job(
        _run_exchange_rate_refresh,
        IntervalTrigger(seconds=EXCHANGE_RATE_INTERVAL_SECONDS),
        id=EXCHANGE_RATE_JOB_ID,
        replace_existing=True,
    )
    scheduler.add_job(
        _run_update_check,
        IntervalTrigger(seconds=UPDATE_CHECK_INTERVAL_SECONDS),
        id=UPDATE_CHECK_JOB_ID,
        replace_existing=True,
    )

    # Bedolaga sync (Phase 2). Transactions are cheap/incremental once
    # caught up, so a plain recurring interval is fine (mirrors the
    # exchange-rate job above). Subscriptions/users are a full current-state
    # refetch every time, so once a day at a fixed off-peak time instead.
    scheduler.add_job(
        _run_bedolaga_transactions_sync,
        IntervalTrigger(seconds=BEDOLAGA_TRANSACTIONS_INTERVAL_SECONDS),
        id=BEDOLAGA_TRANSACTIONS_JOB_ID,
        replace_existing=True,
    )
    scheduler.add_job(
        _run_bedolaga_subscriptions_sync,
        CronTrigger(hour=BEDOLAGA_SUBSCRIPTIONS_SYNC_HOUR, minute=BEDOLAGA_SUBSCRIPTIONS_SYNC_MINUTE),
        id=BEDOLAGA_SUBSCRIPTIONS_JOB_ID,
        replace_existing=True,
    )
