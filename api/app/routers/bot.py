"""Bedolaga bot revenue endpoints — /api/bot/revenue(/monthly)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.bot_revenue import fetch_bot_revenue, get_bot_revenue_monthly
from app.core.db import get_db
from app.core.deps import require_user

router = APIRouter(prefix="/api/bot", tags=["bot"], dependencies=[Depends(require_user)])


@router.get("/revenue")
async def bot_revenue(request: Request, db: Session = Depends(get_db)):
    force = request.query_params.get("refresh") == "1"
    return await fetch_bot_revenue(db, force)


@router.get("/revenue/monthly")
def bot_revenue_monthly(db: Session = Depends(get_db)):
    return {"months": get_bot_revenue_monthly(db, 12)}
