"""Date normalization — ported verbatim from server.js's normalizeDateTime/
normalizeNotificationLeads/parseDurationToken.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

_DATE_ONLY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")
_DURATION_RE = re.compile(r"^(\d+)\s*([mhd])$")


def iso_from_datetime(value: datetime) -> str:
    """Format matching Node's `date.toISOString()` exactly (millisecond
    precision, trailing 'Z') — `datetime.isoformat()` on its own produces
    microsecond precision and a '+00:00' offset instead, which is an
    equally valid ISO 8601 string but not byte-identical to what Node
    would have written for the same stored column."""
    aware = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return aware.strftime("%Y-%m-%dT%H:%M:%S.") + f"{aware.microsecond // 1000:03d}Z"


def now_iso() -> str:
    return iso_from_datetime(datetime.now(timezone.utc))


def iso_from_timestamp(epoch_seconds: float) -> str:
    return iso_from_datetime(datetime.fromtimestamp(epoch_seconds, tz=timezone.utc))


def normalize_date_time(value: str | None, date_only_ok: bool = False) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    if _DATE_ONLY_RE.match(raw):
        return raw if date_only_ok else f"{raw}T00:00"
    if _DATETIME_RE.match(raw):
        return raw[:16]
    return raw


def parse_duration_token(value: str) -> dict | None:
    match = _DURATION_RE.match((value or "").strip().lower())
    if not match:
        return None
    amount = int(match.group(1))
    if amount < 1:
        return None
    unit = match.group(2)
    multiplier = {"m": 1, "h": 60, "d": 1440}[unit]
    return {"value": f"{amount}{unit}", "amount": amount, "unit": unit, "minutes": amount * multiplier}


def normalize_notification_leads(value: str | None) -> str:
    leads = [parsed for item in (value or "").split(",") if (parsed := parse_duration_token(item.strip()))]
    if not leads:
        return "5m,2h,1d,3d,5d"
    unique = {lead["value"]: lead for lead in leads}
    ordered = sorted(unique.values(), key=lambda lead: lead["minutes"])
    return ",".join(lead["value"] for lead in ordered)
