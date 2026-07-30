"""Telegram alert/report text builders — ported from server.js's alertText/
monthlyReportText/formatDateTime/formatDuration/formatLead/formatMoney/
groupPaymentsByCurrency/formatPaymentTotal/typeLabel/countryLabel/
escapeTelegram/countryFlags. Money/date formatting approximates Node's
Intl output (ru-RU / en-US) by hand — exact ICU parity doesn't matter for a
human-read chat message the way it does for the JSON API contract.
"""

from __future__ import annotations

import re
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.locale import t, tc

COUNTRY_FLAGS = {
    "": "🌐", "RU": "🇷🇺", "DE": "🇩🇪", "NL": "🇳🇱", "FI": "🇫🇮", "FR": "🇫🇷", "GB": "🇬🇧", "US": "🇺🇸",
    "CA": "🇨🇦", "PL": "🇵🇱", "CZ": "🇨🇿", "SE": "🇸🇪", "NO": "🇳🇴", "CH": "🇨🇭", "AT": "🇦🇹", "ES": "🇪🇸",
    "IT": "🇮🇹", "TR": "🇹🇷", "AE": "🇦🇪", "KZ": "🇰🇿", "UA": "🇺🇦", "BY": "🇧🇾", "LT": "🇱🇹", "LV": "🇱🇻",
    "EE": "🇪🇪", "RO": "🇷🇴", "BG": "🇧🇬", "MD": "🇲🇩", "GE": "🇬🇪", "AM": "🇦🇲", "AZ": "🇦🇿", "SG": "🇸🇬",
    "JP": "🇯🇵", "KR": "🇰🇷", "HK": "🇭🇰", "IN": "🇮🇳", "AU": "🇦🇺", "BR": "🇧🇷", "AR": "🇦🇷", "MX": "🇲🇽",
    "ZA": "🇿🇦",
}

_ESCAPE_RE = re.compile(r"[<>&]")
_ESCAPE_MAP = {"<": "&lt;", ">": "&gt;", "&": "&amp;"}
_MONTH_NAMES_RU = [
    "январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
]
_MONTH_NAMES_EN = [
    "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
]


def escape_telegram(value) -> str:
    return _ESCAPE_RE.sub(lambda m: _ESCAPE_MAP[m.group(0)], str(value))


def country_label(code: str, locale: str = "ru") -> str:
    country_code = (code or "").upper()
    flag = COUNTRY_FLAGS.get(country_code, COUNTRY_FLAGS[""])
    name = t(locale, f"countries.{country_code}") or t(locale, "common.countryEmpty")
    return f"{flag} {name}" if country_code else name


def _format_number(value: float, thousands_sep: str, decimal_sep: str) -> str:
    sign = "-" if value < 0 else ""
    whole, _, frac = f"{abs(value):.2f}".partition(".")
    grouped = f"{int(whole):,}".replace(",", thousands_sep)
    return f"{sign}{grouped}{decimal_sep}{frac}"


def parse_app_date(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = str(value)
    local_value = raw if "T" in raw else f"{raw}T00:00"
    try:
        return datetime.fromisoformat(local_value)
    except ValueError:
        return None


def format_date_time(value: str | None, locale: str, timezone: str) -> str:
    parsed = parse_app_date(value)
    if parsed is None:
        return ""
    aware = parsed.replace(tzinfo=ZoneInfo(timezone)) if parsed.tzinfo is None else parsed.astimezone(ZoneInfo(timezone))
    if locale == "en":
        hour = aware.hour % 12 or 12
        period = "AM" if aware.hour < 12 else "PM"
        return f"{aware.month}/{aware.day}/{aware.year % 100:02d}, {hour}:{aware.minute:02d} {period}"
    return f"{aware.day:02d}.{aware.month:02d}.{aware.year:04d}, {aware.hour:02d}:{aware.minute:02d}"


def format_duration(minutes, locale: str = "ru") -> str:
    total = max(0, int(minutes or 0))
    days = total // 1440
    hours = (total % 1440) // 60
    mins = total % 60
    if days:
        return f"{tc(locale, 'day', days)} {tc(locale, 'hour', hours)}"
    if hours:
        return f"{tc(locale, 'hour', hours)} {tc(locale, 'minute', mins)}"
    return tc(locale, "minute", mins)


def format_lead(lead: dict | None, locale: str = "ru") -> str:
    if not lead:
        return ""
    key = "minute" if lead["unit"] == "m" else "hour" if lead["unit"] == "h" else "day"
    return tc(locale, key, lead["amount"])


def format_money(value, currency: str = "USDT", locale: str = "ru") -> str:
    num = float(value or 0)
    if locale == "en":
        formatted = _format_number(num, ",", ".")
        if currency == "EUR":
            return f"€{formatted}"
        if currency == "RUB":
            return f"RUB {formatted}"
        return f"{formatted} USDT"
    formatted = _format_number(num, " ", ",")
    if currency == "EUR":
        return f"{formatted} €"
    if currency == "RUB":
        return f"{formatted} ₽"
    return f"{formatted} USDT"


def group_payments_by_currency(payments: list[dict]) -> list[dict]:
    from app.core.meta import CURRENCIES, normalize_currency

    totals: dict[str, float] = {}
    for payment in payments or []:
        currency = normalize_currency(payment.get("currency"))
        totals[currency] = totals.get(currency, 0) + float(payment.get("amount") or 0)
    return [{"currency": c, "amount": totals[c]} for c in CURRENCIES if c in totals]


def format_payment_total(payments: list[dict], locale: str = "ru") -> str:
    groups = group_payments_by_currency(payments)
    if not groups:
        return format_money(0, "USDT", locale)
    return " + ".join(format_money(g["amount"], g["currency"], locale) for g in groups)


def type_label(asset_type: str, locale: str = "ru") -> str:
    return t(locale, f"type.{asset_type}") or t(locale, "type.record")


def alert_text(item: dict, locale: str = "ru", timezone: str = "Europe/Moscow") -> str:
    minutes_left = item["minutesLeft"]
    if minutes_left < 0:
        when = t(locale, "duration.overdueLower", {"duration": format_duration(abs(minutes_left), locale)})
    elif minutes_left == 0:
        when = t(locale, "common.now")
    else:
        when = t(locale, "duration.in", {"duration": format_duration(minutes_left, locale)})
    asset = item["asset"]
    provider = item.get("provider")
    target = asset["ip"] if asset["type"] == "vps" else asset["domain"]
    paid = format_payment_total(asset.get("payments", []), locale)
    country = country_label(asset["countryCode"], locale) if asset["type"] == "vps" and asset.get("countryCode") else ""
    lines = [
        t(locale, "telegram.title"),
        "",
        f"<b>{escape_telegram(type_label(asset['type'], locale))}:</b> {escape_telegram(asset['name'])}",
        (
            f"<b>{escape_telegram(t(locale, 'telegram.provider'))}:</b> {escape_telegram(provider['name'])}"
            if provider
            else f"<b>{escape_telegram(t(locale, 'telegram.provider'))}:</b> {escape_telegram(t(locale, 'common.providerEmpty'))}"
        ),
        (
            f"<b>{'IP' if asset['type'] == 'vps' else escape_telegram(t(locale, 'common.domain'))}:</b> {escape_telegram(target)}"
            if target
            else ""
        ),
        f"<b>{escape_telegram(t(locale, 'common.country'))}:</b> {escape_telegram(country)}" if country else "",
        f"<b>{escape_telegram(t(locale, 'telegram.expiresAt'))}:</b> {escape_telegram(format_date_time(asset['expiresAt'], locale, timezone))}",
        f"<b>{escape_telegram(t(locale, 'telegram.left'))}:</b> {escape_telegram(when)}",
        (
            f"<b>{escape_telegram(t(locale, 'telegram.trigger'))}:</b> {escape_telegram(t(locale, 'telegram.triggerBefore', {'lead': format_lead(item.get('lead'), locale)}))}"
            if item.get("lead")
            else ""
        ),
        f"<b>{escape_telegram(t(locale, 'telegram.paidTotal'))}:</b> {escape_telegram(paid)}",
    ]
    return "\n".join(line for line in lines if line)


def _month_label(month_date: datetime, locale: str) -> str:
    if locale == "en":
        return f"{_MONTH_NAMES_EN[month_date.month - 1]} {month_date.year}"
    return f"{_MONTH_NAMES_RU[month_date.month - 1]} {month_date.year} г."


def monthly_report_text(income_rub: float, expense_rub: float, month_date: datetime, locale: str = "ru") -> str:
    net_rub = income_rub - expense_rub
    month_label = _month_label(month_date, locale)
    lines = [
        t(locale, "telegram.monthlyReportTitle", {"month": month_label}),
        "",
        f"<b>{escape_telegram(t(locale, 'telegram.income'))}:</b> {escape_telegram(format_money(income_rub, 'RUB', locale))}",
        f"<b>{escape_telegram(t(locale, 'telegram.expense'))}:</b> {escape_telegram(format_money(expense_rub, 'RUB', locale))}",
        f"<b>{escape_telegram(t(locale, 'telegram.net'))}:</b> {escape_telegram(format_money(net_rub, 'RUB', locale))}",
    ]
    return "\n".join(lines)
