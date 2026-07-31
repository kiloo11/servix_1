"""Serves the Next.js static export (dist/) — ported from server.js's
serveStatic/cacheControlFor/streamFile. Registered as a catch-all route in
main.py, tried only after every /api/* router has had a chance to match.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse

from app.core.config import get_settings

# Hardcoded, not mimetypes.guess_type() — that's OS-dependent and doesn't
# reliably know .webmanifest, which would otherwise serve with a generic
# octet-stream type and break PWA manifest detection in some browsers.
MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".txt": "text/plain; charset=utf-8",
}


def _media_type_for(path: Path) -> str:
    return MIME_TYPES.get(path.suffix, "application/octet-stream")


def _cache_control_for(request_path: str) -> str:
    return "public, max-age=31536000, immutable" if request_path.startswith("/_next/static/") else "no-cache"


def serve_static(request_path: str) -> FileResponse:
    public_root = get_settings().public_dir.resolve()
    requested = "/index.html" if request_path in ("", "/") else f"/{request_path}"
    candidate = (public_root / requested.lstrip("/")).resolve()

    if candidate != public_root and public_root not in candidate.parents:
        raise HTTPException(status_code=403, detail="Forbidden")

    cache_control = _cache_control_for(requested)
    if candidate.is_file():
        return FileResponse(candidate, media_type=_media_type_for(candidate), headers={"cache-control": cache_control})

    # Next.js static export (trailingSlash: true) lays each route out as
    # <route>/index.html — try that before giving up and falling back to
    # the root SPA shell.
    route_index = candidate / "index.html"
    if route_index.is_file():
        return FileResponse(route_index, media_type=MIME_TYPES[".html"], headers={"cache-control": "no-cache"})

    root_index = public_root / "index.html"
    if root_index.is_file():
        return FileResponse(root_index, media_type=MIME_TYPES[".html"], headers={"cache-control": "no-cache"})

    raise HTTPException(status_code=404, detail="Не найдено. Выполните npm run build.")
