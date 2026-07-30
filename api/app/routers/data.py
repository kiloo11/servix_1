"""Core data endpoints — /api/assets, /api/providers, /api/categories,
/api/settings. All require auth (server.js gates everything after the
plain auth endpoints behind requireAuth(); here that's the `require_user`
dependency on every route).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.access_log import log_action, read_access_log
from app.core.db import get_db
from app.core.deps import require_user
from app.core.dates import normalize_notification_leads
from app.core.exchange_rates import refresh_exchange_rates
from app.core.meta import get_meta, normalize_currency, normalize_timezone, set_meta
from app.core.records import (
    delete_asset,
    delete_category,
    delete_provider,
    get_data,
    normalize_asset,
    normalize_category_entity,
    normalize_provider,
    reorder_assets,
    upsert_asset,
    upsert_category,
    upsert_provider,
)
from app.core.scheduler import get_due_items
from app import models

router = APIRouter(prefix="/api", tags=["data"], dependencies=[Depends(require_user)])


class FlexibleBody(BaseModel):
    """Accepts arbitrary JSON — the normalize_* functions do their own
    validation/defaulting (same permissive shape server.js's readBody() +
    normalize* had), so a rigid Pydantic schema would just duplicate that
    logic and risk drifting from it."""

    model_config = ConfigDict(extra="allow")

    def dict_(self) -> dict[str, Any]:
        return self.model_dump()


@router.get("/assets")
def list_assets(db: Session = Depends(get_db)):
    return get_data(db)


@router.get("/logs")
async def list_logs():
    return {"items": read_access_log()}


@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db)):
    return {"items": get_due_items(db)}


@router.post("/rates/refresh")
async def refresh_rates(request: Request, db: Session = Depends(get_db)):
    await refresh_exchange_rates(db)
    await log_action(request, "rates.refresh")
    return get_meta(db)


@router.post("/assets", status_code=201)
async def create_asset(request: Request, body: FlexibleBody, db: Session = Depends(get_db)):
    try:
        asset = upsert_asset(db, normalize_asset(db, body.dict_()))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await log_action(request, "asset.create", {"id": asset["id"], "type": asset["type"], "name": asset["name"]})
    return asset


@router.post("/assets/reorder")
async def reorder_assets_route(request: Request, body: FlexibleBody, db: Session = Depends(get_db)):
    data = body.dict_()
    try:
        result = reorder_assets(db, data.get("type"), data.get("ids") or [], bool(data.get("inactive")))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await log_action(request, "asset.reorder", {"type": data.get("type"), "count": len(data.get("ids") or [])})
    return {"assets": result}


def _find_asset(db: Session, asset_id: str) -> dict | None:
    from app.core.records import asset_to_dict

    row = db.get(models.Asset, asset_id)
    return asset_to_dict(row) if row else None


@router.put("/assets/{asset_id}")
async def update_asset(asset_id: str, request: Request, body: FlexibleBody, db: Session = Depends(get_db)):
    existing = _find_asset(db, asset_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    try:
        asset = upsert_asset(db, normalize_asset(db, body.dict_(), existing))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await log_action(request, "asset.update", {"id": asset["id"], "type": asset["type"], "name": asset["name"]})
    return asset


@router.delete("/assets/{asset_id}")
async def remove_asset(asset_id: str, request: Request, db: Session = Depends(get_db)):
    existing = _find_asset(db, asset_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    asset = delete_asset(db, asset_id)
    await log_action(request, "asset.delete", {"id": existing["id"], "type": existing["type"], "name": existing["name"]})
    return asset


@router.post("/providers", status_code=201)
async def create_provider(request: Request, body: FlexibleBody, db: Session = Depends(get_db)):
    try:
        provider = upsert_provider(db, normalize_provider(body.dict_()))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await log_action(request, "provider.create", {"id": provider["id"], "name": provider["name"]})
    return provider


def _find_provider(db: Session, provider_id: str) -> dict | None:
    from app.core.records import provider_to_dict

    row = db.get(models.Provider, provider_id)
    return provider_to_dict(row) if row else None


@router.put("/providers/{provider_id}")
async def update_provider(provider_id: str, request: Request, body: FlexibleBody, db: Session = Depends(get_db)):
    existing = _find_provider(db, provider_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Провайдер не найден")
    try:
        provider = upsert_provider(db, normalize_provider(body.dict_(), existing))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await log_action(request, "provider.update", {"id": provider["id"], "name": provider["name"]})
    return provider


@router.delete("/providers/{provider_id}")
async def remove_provider(provider_id: str, request: Request, db: Session = Depends(get_db)):
    existing = _find_provider(db, provider_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Провайдер не найден")
    provider = delete_provider(db, provider_id)
    await log_action(request, "provider.delete", {"id": existing["id"], "name": existing["name"]})
    return provider


@router.post("/categories", status_code=201)
async def create_category(request: Request, body: FlexibleBody, db: Session = Depends(get_db)):
    try:
        category = upsert_category(db, normalize_category_entity(body.dict_()))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await log_action(request, "category.create", {"id": category["id"], "name": category["name"]})
    return category


def _find_category(db: Session, category_id: str) -> dict | None:
    from app.core.records import category_to_dict

    row = db.get(models.Category, category_id)
    return category_to_dict(row) if row else None


@router.put("/categories/{category_id}")
async def update_category(category_id: str, request: Request, body: FlexibleBody, db: Session = Depends(get_db)):
    existing = _find_category(db, category_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    try:
        category = upsert_category(db, normalize_category_entity(body.dict_(), existing))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await log_action(request, "category.update", {"id": category["id"], "name": category["name"]})
    return category


@router.delete("/categories/{category_id}")
async def remove_category(category_id: str, request: Request, db: Session = Depends(get_db)):
    existing = _find_category(db, category_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    category = delete_category(db, category_id)
    await log_action(request, "category.delete", {"id": existing["id"], "name": existing["name"]})
    return category


@router.put("/settings")
async def update_settings(request: Request, body: FlexibleBody, db: Session = Depends(get_db)):
    from app.core.config import get_settings
    from app.core.locale import AVAILABLE_LOCALES

    data = body.dict_()
    settings = get_settings()
    set_meta(db, "siteTitle", str(data.get("siteTitle") or settings.site_title).strip())
    set_meta(db, "notificationLeads", normalize_notification_leads(data.get("notificationLeads")))
    set_meta(db, "locale", data.get("locale") if data.get("locale") in AVAILABLE_LOCALES else "ru")
    try:
        set_meta(db, "timezone", normalize_timezone(data.get("timezone")))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    set_meta(db, "telegramNotifyUrl", str(data.get("telegramNotifyUrl") or "").strip())
    set_meta(db, "notifyOnStart", str(bool(data.get("notifyOnStart"))))
    set_meta(db, "currency", normalize_currency(data.get("currency")))
    db.commit()

    from app.core.hooks import on_asset_changed

    on_asset_changed()  # recompute Telegram schedule with the new leads/timezone

    await log_action(
        request,
        "settings.update",
        {"locale": data.get("locale"), "timezone": data.get("timezone"), "telegramConfigured": bool(data.get("telegramNotifyUrl"))},
    )
    return get_meta(db)
