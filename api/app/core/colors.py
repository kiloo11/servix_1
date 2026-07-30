"""Color/URL normalization shared by providers and categories — ported
verbatim from server.js's normalizeColor/normalizeExternalUrl/
randomProviderColor/hslToHex/normalizeFaviconUrl.
"""

from __future__ import annotations

import hashlib
import re
from urllib.parse import urlparse

_COLOR_RE = re.compile(r"^#[0-9a-f]{6}$", re.IGNORECASE)
_FAVICON_EXTS = {".ico", ".png", ".jpg", ".jpeg", ".svg", ".webp"}


def normalize_color(value: str | None) -> str:
    color = (value or "").strip()
    return color.lower() if _COLOR_RE.match(color) else ""


def normalize_external_url(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlparse(raw)
        if parsed.scheme in ("http", "https") and parsed.netloc:
            return raw
    except ValueError:
        pass
    return ""


def hsl_to_hex(hue: float, saturation: float, lightness: float) -> str:
    s = saturation / 100
    light = lightness / 100
    c = (1 - abs(2 * light - 1)) * s
    x = c * (1 - abs((hue / 60) % 2 - 1))
    m = light - c / 2
    if hue < 60:
        r, g, b = c, x, 0.0
    elif hue < 120:
        r, g, b = x, c, 0.0
    elif hue < 180:
        r, g, b = 0.0, c, x
    elif hue < 240:
        r, g, b = 0.0, x, c
    elif hue < 300:
        r, g, b = x, 0.0, c
    else:
        r, g, b = c, 0.0, x
    return "#" + "".join(f"{round((value + m) * 255):02x}" for value in (r, g, b))


def random_provider_color(seed: str) -> str:
    digest = hashlib.sha256(seed.encode()).digest()
    hue = digest[0] % 360
    saturation = 58 + (digest[1] % 18)
    lightness = 48 + (digest[2] % 12)
    return hsl_to_hex(hue, saturation, lightness)


def normalize_favicon_url(raw: str | None) -> str:
    value = normalize_external_url(raw)
    if not value:
        return ""
    parsed = urlparse(value)
    ext = ""
    if "." in parsed.path.rsplit("/", 1)[-1]:
        ext = "." + parsed.path.rsplit(".", 1)[-1].lower()
    if not ext or parsed.path in ("", "/") or ext not in _FAVICON_EXTS:
        return f"{parsed.scheme}://{parsed.netloc}/favicon.ico"
    return value
