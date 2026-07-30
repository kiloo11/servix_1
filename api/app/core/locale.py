"""Backend i18n — a separate, much smaller copy of the same t/tc/loadLocales
pattern web/lib/i18n.js has for the frontend (used here only for building
Telegram notification text). Ported verbatim from server.js's t/tc/getPath/
interpolate/pluralIndex/loadLocales.
"""

from __future__ import annotations

import json
import logging
import re

from app.core.config import get_settings

logger = logging.getLogger(__name__)

AVAILABLE_LOCALES = ("ru", "en")

_INTERPOLATE_RE = re.compile(r"\{(\w+)\}")
_locales: dict[str, dict] | None = None


def _load_locales() -> dict[str, dict]:
    settings = get_settings()
    result: dict[str, dict] = {}
    for locale in AVAILABLE_LOCALES:
        path = settings.locale_dir / f"{locale}.json"
        try:
            result[locale] = json.loads(path.read_text(encoding="utf-8"))
        except OSError as error:
            logger.warning("Locale %s skipped: %s", locale, error)
    return result


def _locales_dict() -> dict[str, dict]:
    global _locales
    if _locales is None:
        _locales = _load_locales()
    return _locales


def get_path(obj: dict, path: str):
    value = obj
    for part in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def interpolate(value, params: dict | None = None) -> str:
    params = params or {}
    return _INTERPOLATE_RE.sub(lambda m: str(params.get(m.group(1), "")), str(value))


def plural_index(locale: str, count) -> int:
    value = abs(int(count or 0))
    if locale == "ru":
        mod10 = value % 10
        mod100 = value % 100
        if mod10 == 1 and mod100 != 11:
            return 0
        if 2 <= mod10 <= 4 and (mod100 < 12 or mod100 > 14):
            return 1
        return 2
    return 0 if value == 1 else 1


def t(locale: str, key: str, params: dict | None = None) -> str:
    locales = _locales_dict()
    dictionary = locales.get(locale) or locales.get("ru") or {}
    fallback = locales.get("ru") or {}
    value = get_path(dictionary, key)
    if value is None:
        value = get_path(fallback, key)
    if value is None:
        value = key
    return interpolate(value, params)


def tc(locale: str, key: str, count, params: dict | None = None) -> str:
    locales = _locales_dict()
    forms = get_path(locales.get(locale) or locales.get("ru") or {}, f"plural.{key}")
    if forms is None:
        forms = get_path(locales.get("ru") or {}, f"plural.{key}")
    if not isinstance(forms, list):
        return str(count)
    index = plural_index(locale, count)
    form = forms[index] if index < len(forms) else forms[-1]
    merged = {**(params or {}), "count": count}
    return interpolate(form, merged)
