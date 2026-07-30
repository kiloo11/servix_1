"""Self-update endpoints — /api/update, /api/update/check, /api/update/apply."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.access_log import log_action
from app.core.deps import require_user
from app.core.update import check_for_update, start_update

router = APIRouter(prefix="/api/update", tags=["update"], dependencies=[Depends(require_user)])


@router.get("")
async def get_update_status(request: Request):
    return await check_for_update(request.query_params.get("refresh") == "1")


@router.post("/check")
async def check_update(request: Request):
    status = await check_for_update(True)
    await log_action(request, "update.check", {"version": status["version"], "latest": status["latest"], "error": status["error"]})
    return status


@router.post("/apply", status_code=202)
async def apply_update(request: Request):
    try:
        status = start_update()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await log_action(request, "update.apply", {"from": status["version"], "to": status["latest"]})
    return status
