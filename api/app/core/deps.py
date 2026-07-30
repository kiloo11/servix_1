"""FastAPI dependencies for auth — cookie parsing, current-user resolution,
client IP, and the same "not logged in -> 401" gate every mutating server.js
endpoint used via requireAuth().
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session as DbSession

from app.core.config import get_settings
from app.core.db import get_db
from app.core.sessions import resolve_session
from app import models


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def is_secure_request(request: Request) -> bool:
    if get_settings().cookie_secure:
        return True
    proto = request.headers.get("x-forwarded-proto", "")
    if proto.split(",")[0].strip() == "https":
        return True
    return request.url.scheme == "https"


def session_cookie_value(request: Request) -> str:
    return request.cookies.get("session", "")


def get_current_user(request: Request, db: DbSession = Depends(get_db)) -> models.User | None:
    token = session_cookie_value(request)
    if not token:
        return None
    session = resolve_session(token)
    if not session:
        return None
    return db.get(models.User, session.user_id)


def require_user(user: models.User | None = Depends(get_current_user)) -> models.User:
    if user is None:
        raise HTTPException(status_code=401, detail="Auth required")
    return user
