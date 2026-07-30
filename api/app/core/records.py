"""Assets/payments/providers/categories — normalize + upsert + delete +
bulk-read, ported from server.js's normalizeAsset/normalizePayments/
upsertAsset/reorderAssets/normalizeProvider/upsertProvider/
normalizeCategoryEntity/upsertCategory/getData family. Dicts everywhere use
the same camelCase keys as the JSON API (no renaming needed at the router).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.colors import normalize_color, normalize_external_url, normalize_favicon_url, random_provider_color
from app.core.dates import normalize_date_time, now_iso
from app.core.hooks import on_asset_changed
from app.core.meta import normalize_currency
from app import models

ASSET_TYPES = ["vps", "domain", "certificate"]


def _now() -> str:
    return now_iso()


# ─── Categories ──────────────────────────────────────────────────────────

def normalize_category_ref(db: Session, value: str | None) -> str:
    category_id = (value or "").strip()
    if not category_id:
        return ""
    exists = db.get(models.Category, category_id)
    return category_id if exists else ""


def normalize_category_entity(input: dict, previous: dict | None = None) -> dict:
    previous = previous or {}
    name = str(input.get("name") or "").strip()
    if not name:
        raise ValueError("Название категории обязательно")
    category_id = previous.get("id") or input.get("id") or str(uuid.uuid4())
    color = normalize_color(input.get("color")) or normalize_color(previous.get("color")) or random_provider_color(category_id)
    return {
        "id": category_id,
        "name": name,
        "color": color,
        "sortOrder": int(input.get("sortOrder", previous.get("sortOrder", int(datetime.now().timestamp() * 1000)))),
        "createdAt": previous.get("createdAt") or _now(),
        "updatedAt": _now(),
    }


def category_to_dict(row: models.Category) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "color": row.color,
        "sortOrder": row.sort_order,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


def upsert_category(db: Session, category: dict) -> dict:
    row = db.get(models.Category, category["id"])
    if row is None:
        row = models.Category(id=category["id"])
        db.add(row)
    row.name = category["name"]
    row.color = category["color"]
    row.sort_order = category["sortOrder"]
    row.created_at = category["createdAt"]
    row.updated_at = category["updatedAt"]
    db.commit()
    return category


def delete_category(db: Session, category_id: str) -> dict | None:
    row = db.get(models.Category, category_id)
    if row is None:
        return None
    result = category_to_dict(row)
    db.delete(row)
    db.execute(models.Asset.__table__.update().where(models.Asset.category == category_id).values(category=""))
    db.commit()
    return result


# ─── Providers ───────────────────────────────────────────────────────────

def normalize_provider(input: dict, previous: dict | None = None) -> dict:
    previous = previous or {}
    name = str(input.get("name") or "").strip()
    if not name:
        raise ValueError("Название провайдера обязательно")
    login_url = normalize_external_url(input.get("loginUrl"))
    provider_id = previous.get("id") or input.get("id") or str(uuid.uuid4())
    return {
        "id": provider_id,
        "name": name,
        "loginUrl": login_url,
        "faviconUrl": normalize_favicon_url(input.get("faviconUrl")),
        "color": normalize_color(input.get("color")) or normalize_color(previous.get("color")) or "",
        "note": str(input.get("note", previous.get("note", "")) or "").strip(),
        "createdAt": previous.get("createdAt") or _now(),
        "updatedAt": _now(),
    }


def provider_to_dict(row: models.Provider) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "loginUrl": row.login_url,
        "faviconUrl": row.favicon_url,
        "color": row.color,
        "note": row.note,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


def upsert_provider(db: Session, provider: dict) -> dict:
    row = db.get(models.Provider, provider["id"])
    if row is None:
        row = models.Provider(id=provider["id"])
        db.add(row)
    row.name = provider["name"]
    row.login_url = provider["loginUrl"]
    row.favicon_url = provider["faviconUrl"]
    row.color = provider["color"]
    row.note = provider["note"]
    row.created_at = provider["createdAt"]
    row.updated_at = provider["updatedAt"]
    db.commit()
    return provider


def delete_provider(db: Session, provider_id: str) -> dict | None:
    row = db.get(models.Provider, provider_id)
    if row is None:
        return None
    result = provider_to_dict(row)
    db.delete(row)
    db.execute(models.Asset.__table__.update().where(models.Asset.provider_id == provider_id).values(provider_id=""))
    db.commit()
    return result


# ─── Payments (embedded in assets, same as server.js) ───────────────────

def normalize_payments(input: list[dict] | None) -> list[dict]:
    if not isinstance(input, list):
        return []
    result = []
    for payment in input:
        amount = float(payment.get("amount") or 0)
        paid_at = normalize_date_time(payment.get("paidAt"), date_only_ok=True)
        note = str(payment.get("note") or "").strip()
        if amount > 0 or paid_at or note:
            result.append(
                {
                    "id": payment.get("id") or str(uuid.uuid4()),
                    "amount": amount,
                    "currency": normalize_currency(payment.get("currency")),
                    "paidAt": paid_at,
                    "note": note,
                    "createdAt": payment.get("createdAt") or _now(),
                }
            )
    return result


def payment_to_dict(row: models.Payment) -> dict:
    return {
        "id": row.id,
        "amount": row.amount,
        "currency": row.currency,
        "paidAt": row.paid_at,
        "note": row.note,
        "createdAt": row.created_at,
    }


# ─── Assets ──────────────────────────────────────────────────────────────

def normalize_asset(db: Session, input: dict, previous: dict | None = None) -> dict:
    previous = previous or {}
    asset_type = input.get("type") if input.get("type") in ASSET_TYPES else "vps"
    name = str(input.get("name") or "").strip()
    if not name:
        raise ValueError("Название обязательно")
    return {
        "id": previous.get("id") or input.get("id") or str(uuid.uuid4()),
        "type": asset_type,
        "name": name,
        "providerId": str(input.get("providerId") or "").strip(),
        "expiresAt": normalize_date_time(input.get("expiresAt")),
        "ip": str(input.get("ip") or "").strip() if asset_type == "vps" else "",
        "domain": (str(input.get("domain") or name).strip() if asset_type != "vps" else ""),
        "countryCode": (
            str(input.get("countryCode", previous.get("countryCode", ""))).strip().upper()[:2] if asset_type == "vps" else ""
        ),
        "sortOrder": int(input.get("sortOrder", previous.get("sortOrder", int(datetime.now().timestamp() * 1000)))),
        "inactive": bool(input.get("inactive", previous.get("inactive", False))),
        "category": normalize_category_ref(db, input.get("category", previous.get("category"))),
        "price": max(0.0, float(input.get("price", previous.get("price", 0)) or 0)),
        "priceCurrency": normalize_currency(input.get("priceCurrency", previous.get("priceCurrency"))),
        "payments": normalize_payments(input.get("payments", previous.get("payments", []))),
        "createdAt": previous.get("createdAt") or _now(),
        "updatedAt": _now(),
    }


def asset_to_dict(row: models.Asset, include_payments: bool = True) -> dict:
    result = {
        "id": row.id,
        "type": row.type,
        "name": row.name,
        "providerId": row.provider_id,
        "expiresAt": row.expires_at,
        "ip": row.ip,
        "domain": row.domain,
        "countryCode": row.country_code,
        "sortOrder": row.sort_order,
        "inactive": bool(row.inactive),
        "category": row.category,
        "price": row.price,
        "priceCurrency": row.price_currency,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }
    if include_payments:
        result["payments"] = [payment_to_dict(p) for p in sorted(row.payments, key=lambda p: (p.paid_at, p.created_at), reverse=True)]
    return result


def upsert_asset(db: Session, asset: dict) -> dict:
    row = db.get(models.Asset, asset["id"])
    if row is None:
        row = models.Asset(id=asset["id"])
        db.add(row)
    row.type = asset["type"]
    row.name = asset["name"]
    row.provider_id = asset["providerId"]
    row.expires_at = asset["expiresAt"]
    row.ip = asset["ip"]
    row.domain = asset["domain"]
    row.country_code = asset["countryCode"]
    row.sort_order = asset["sortOrder"]
    row.inactive = 1 if asset["inactive"] else 0
    row.category = asset["category"]
    row.price = asset["price"]
    row.price_currency = asset["priceCurrency"]
    row.created_at = asset["createdAt"]
    row.updated_at = asset["updatedAt"]
    db.flush()  # need row.id persisted before writing payments referencing it

    db.query(models.Payment).filter(models.Payment.asset_id == row.id).delete()
    for payment in asset.get("payments", []):
        db.add(
            models.Payment(
                id=payment["id"],
                asset_id=row.id,
                amount=payment["amount"],
                currency=payment["currency"] or "USDT",
                paid_at=payment["paidAt"],
                note=payment["note"],
                created_at=payment["createdAt"],
            )
        )
    db.commit()
    on_asset_changed()
    return asset


def delete_asset(db: Session, asset_id: str) -> dict | None:
    row = db.get(models.Asset, asset_id)
    if row is None:
        return None
    result = asset_to_dict(row)
    db.delete(row)
    db.commit()
    on_asset_changed()
    return result


def reorder_assets(db: Session, asset_type: str, ids: list[str], inactive: bool = False) -> list[dict]:
    if asset_type not in ASSET_TYPES or not isinstance(ids, list):
        raise ValueError("Invalid reorder request")
    inactive_value = 1 if inactive else 0
    existing_ids = [
        row.id
        for row in db.scalars(
            select(models.Asset).where(models.Asset.type == asset_type, models.Asset.inactive == inactive_value)
        )
    ]
    existing_set = set(existing_ids)
    ordered_ids = [asset_id for asset_id in ids if asset_id in existing_set]
    if len(ordered_ids) != len(existing_ids):
        raise ValueError("Invalid assets order")
    now = _now()
    for index, asset_id in enumerate(ordered_ids):
        row = db.get(models.Asset, asset_id)
        row.sort_order = index
        row.updated_at = now
    db.commit()
    rows = db.scalars(
        select(models.Asset)
        .where(models.Asset.type == asset_type, models.Asset.inactive == inactive_value)
        .order_by(models.Asset.sort_order)
    )
    return [asset_to_dict(row) for row in rows]


# ─── Bulk read ───────────────────────────────────────────────────────────

def get_data(db: Session) -> dict:
    from app.core.meta import get_meta

    providers = [provider_to_dict(row) for row in db.scalars(select(models.Provider).order_by(models.Provider.created_at.desc()))]
    categories = [
        category_to_dict(row)
        for row in db.scalars(select(models.Category).order_by(models.Category.sort_order, models.Category.created_at))
    ]
    assets = [
        asset_to_dict(row)
        for row in db.scalars(select(models.Asset).order_by(models.Asset.type, models.Asset.sort_order, models.Asset.created_at.desc()))
    ]
    return {"meta": get_meta(db), "providers": providers, "categories": categories, "assets": assets}
