"""FastAPI entrypoint. Runs Alembic migrations on startup (idempotent —
no-op on an already-current DB, same self-managing behavior server.js's
initDb() had with its CREATE TABLE IF NOT EXISTS / ensureColumn calls),
seeds meta defaults + the default categories, then starts serving.
"""

from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_app_version, get_settings
from app.core.dates import now_iso
from app.core.db import SessionLocal
from app.core.exchange_rates import refresh_exchange_rates
from app.core.meta import init_meta_defaults
from app.core.scheduler import init_scheduler
from app.core.update import check_for_update
from app.routers import auth as auth_router
from app.routers import bedolaga as bedolaga_router
from app.routers import bot as bot_router
from app.routers import dashboard as dashboard_router
from app.routers import data as data_router
from app.routers import telegram as telegram_router
from app.routers import update as update_router

API_DIR = Path(__file__).resolve().parent.parent

# server.js's console.warn/console.log always reach stdout unconditionally;
# match that here so background-job failures (Telegram send errors, exchange
# rate refresh failures, etc.) are never silently swallowed.
logging.basicConfig(level=logging.INFO)


def run_migrations() -> None:
    config = Config(str(API_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(API_DIR / "alembic"))
    command.upgrade(config, "head")


def seed_categories(db) -> None:
    from app import models

    if db.query(models.Category).count() > 0:
        return

    now = now_iso()
    defaults = [
        ("infra", "Инфраструктура", "#cf00a3"),
        ("node", "Ноды", "#22c55e"),
        ("test", "Тестовые", "#f59e0b"),
    ]
    for index, (cat_id, name, color) in enumerate(defaults):
        db.add(models.Category(id=cat_id, name=name, color=color, sort_order=index, created_at=now, updated_at=now))
    db.commit()


def create_app() -> FastAPI:
    app = FastAPI(title="SERVIX API", version=get_app_version())

    @app.on_event("startup")
    async def on_startup() -> None:
        run_migrations()
        db = SessionLocal()
        try:
            init_meta_defaults(db)
            seed_categories(db)
        finally:
            db.close()

        # Fire-and-forget, matching server.js's unconditional
        # refreshExchangeRates().catch(...) / checkForUpdate(true).catch(...)
        # calls at module load — a failure here must never block startup.
        db = SessionLocal()
        try:
            await refresh_exchange_rates(db)
        finally:
            db.close()
        await check_for_update(True)  # never raises - failures are recorded on the status object
        init_scheduler()

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["x-content-type-options"] = "nosniff"
        response.headers["referrer-policy"] = "same-origin"
        response.headers["x-frame-options"] = "DENY"
        # unsafe-inline stays required for the Next.js static export's inline
        # hydration <script> tags — see server.js's identical comment/CSP.
        response.headers["content-security-policy"] = (
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: http: https:; connect-src 'self'; base-uri 'self'; form-action 'self'; "
            "frame-ancestors 'none'"
        )
        if request.url.path.startswith("/api/"):
            response.headers["cache-control"] = "no-store"
        return response

    # server.js wraps the whole request handler in one try/catch that turns
    # any thrown Error into `400 {error: error.message}` — e.g. a rejected
    # Telegram API call inside sendTelegramMessage surfaces this way, not as
    # a 500. Exception is the fallback for everything not already handled
    # by a more specific handler (ValueError, StarletteHTTPException) below
    # — Starlette resolves the most specific handler via the raised
    # instance's MRO, so those two still take priority over this one.
    @app.exception_handler(Exception)
    async def generic_exception_handler(_request: Request, exc: Exception):
        return JSONResponse(status_code=400, content={"error": str(exc) or "Ошибка запроса"})

    @app.exception_handler(ValueError)
    async def value_error_handler(_request: Request, exc: ValueError):
        return JSONResponse(status_code=400, content={"error": str(exc)})

    # The frontend's api() wrapper (web/lib/api.js) reads `data.error` on any
    # non-2xx response — FastAPI's default HTTPException body is
    # `{"detail": ...}`, so without this every error toast would silently
    # fall back to the generic "request failed" text instead of showing the
    # real message.
    #
    # Registered on Starlette's base HTTPException, not fastapi.HTTPException:
    # Starlette's router raises the base class directly for genuinely
    # unmatched routes, and exception-handler lookup walks the MRO of the
    # actually-raised instance — a handler keyed on the fastapi subclass
    # would never see those. The base-class registration still catches every
    # in-route `fastapi.HTTPException` too, since that subclasses it.
    #
    # One handler, not a separate one keyed on the 404 status code: Starlette
    # dispatches HTTPException by status-code handler first when one exists,
    # which would silently swallow every in-route 404 we raise on purpose
    # (e.g. "Запись не найдена" on DELETE of an unknown asset) and replace it
    # with the generic message below — so route-level 404s and Starlette's
    # own "no route matched at all" 404 (whose detail is always exactly
    # "Not Found") have to be told apart by content, in one place.
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        detail = exc.detail
        if exc.status_code == 404 and detail == "Not Found" and request.url.path.startswith("/api/"):
            detail = "API endpoint не найден"
        return JSONResponse(status_code=exc.status_code, content={"error": detail}, headers=exc.headers)

    app.include_router(auth_router.router)
    app.include_router(data_router.router)
    app.include_router(bot_router.router)
    app.include_router(update_router.router)
    app.include_router(telegram_router.router)
    app.include_router(bedolaga_router.router)
    app.include_router(dashboard_router.router)

    return app


app = create_app()
