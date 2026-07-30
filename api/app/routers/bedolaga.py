"""Bedolaga sync endpoints — manual "sync now" trigger + a cheap,
no-network status check for a future Dashboard widget."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.core.bedolaga_sync import (
    LAST_SYNC_AT_KEY,
    LAST_TRANSACTION_ID_KEY,
    sync_subscriptions_and_users,
    sync_transactions,
)
from app.core.db import get_db
from app.core.deps import require_user

router = APIRouter(prefix="/api/bedolaga", tags=["bedolaga"], dependencies=[Depends(require_user)])


def _row_counts(db: Session) -> dict[str, int]:
    return {
        "transactions": db.scalar(select(func.count()).select_from(models.BedolagaTransaction)) or 0,
        "subscriptions": db.scalar(select(func.count()).select_from(models.BedolagaSubscription)) or 0,
        "users": db.scalar(select(func.count()).select_from(models.BedolagaUser)) or 0,
    }


def _meta_value(db: Session, key: str) -> str:
    row = db.get(models.Meta, key)
    return row.value if row else ""


@router.post("/sync")
async def sync_now(db: Session = Depends(get_db)):
    transactions_synced = await sync_transactions(db)
    subscriptions_synced, users_synced = await sync_subscriptions_and_users(db)
    return {
        "transactionsSynced": transactions_synced,
        "subscriptionsSynced": subscriptions_synced,
        "usersSynced": users_synced,
        "rowCounts": _row_counts(db),
        "lastSyncAt": _meta_value(db, LAST_SYNC_AT_KEY),
    }


@router.get("/sync/status")
def sync_status(db: Session = Depends(get_db)):
    return {
        "rowCounts": _row_counts(db),
        "lastSyncAt": _meta_value(db, LAST_SYNC_AT_KEY),
        "lastTransactionId": _meta_value(db, LAST_TRANSACTION_ID_KEY),
    }
