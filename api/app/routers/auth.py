"""Auth endpoints — byte-compatible with server.js's /api/auth/* routes
(same paths, request/response shapes, rate-limit thresholds, and the
requires-2FA-code-on-second-attempt login flow).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.access_log import log_action
from app.core.dates import now_iso
from app.core.db import get_db
from app.core.deps import client_ip, get_current_user, is_secure_request, require_user
from app.core.meta import get_meta, get_public_meta
from app.core.security import (
    generate_totp_secret,
    totp_provisioning_uri,
    verify_password,
    verify_totp,
)
from app.core.sessions import (
    AUTH_RATE_MAX_ATTEMPTS,
    TOTP_RATE_MAX_ATTEMPTS,
    check_rate_limit,
    clear_attempts,
    end_session,
    rate_limit_key,
    record_failed_attempt,
    start_session,
)
from app.core.users import authenticate, create_user, update_password, user_count
from app import models

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_MAX_AGE_SECONDS = 2_592_000


def _set_session_cookie(response: Response, request: Request, token: str, max_age: int = SESSION_MAX_AGE_SECONDS) -> None:
    response.set_cookie(
        "session",
        token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=is_secure_request(request),
        path="/",
    )


class SetupBody(BaseModel):
    login: str = ""
    password: str = ""
    passwordRepeat: str = ""


class LoginBody(BaseModel):
    login: str = ""
    password: str = ""
    token: str = ""


class PasswordBody(BaseModel):
    currentPassword: str = ""
    newPassword: str = ""
    passwordRepeat: str = ""


class TotpBody(BaseModel):
    currentPassword: str = ""
    token: str = ""


@router.get("/status")
def auth_status(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return {
        "setupRequired": user_count(db) == 0,
        "authenticated": user is not None,
        "meta": get_public_meta(db),
    }


@router.post("/setup")
async def auth_setup(request: Request, response: Response, body: SetupBody, db: Session = Depends(get_db)):
    if user_count(db) > 0:
        raise HTTPException(status_code=409, detail="User already exists")
    if body.password != body.passwordRepeat:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    try:
        user = create_user(db, body.login, body.password)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await log_action(request, "auth.setup", {"login": body.login.strip()})
    token = start_session(user.id)
    _set_session_cookie(response, request, token)
    return {"ok": True}


@router.post("/login")
async def auth_login(request: Request, response: Response, body: LoginBody, db: Session = Depends(get_db)):
    login_key = rate_limit_key("login", client_ip(request), body.login)
    ip_key = rate_limit_key("login-ip", client_ip(request))
    if not check_rate_limit(login_key) or not check_rate_limit(ip_key, AUTH_RATE_MAX_ATTEMPTS * 2):
        await log_action(request, "auth.login.rate_limited", {"login": body.login.strip()}, 429)
        raise HTTPException(status_code=429, detail="Too many login attempts")

    user = authenticate(db, body.login, body.password)
    if user:
        if user.totp_enabled and not verify_totp(user.totp_secret, body.token):
            totp_key = rate_limit_key("2fa", client_ip(request), user.login)
            if not check_rate_limit(totp_key, TOTP_RATE_MAX_ATTEMPTS):
                await log_action(request, "auth.login.2fa_rate_limited", {"login": user.login}, 429)
                raise HTTPException(status_code=429, detail="Too many 2FA attempts")
            if not body.token:
                return {"requiresTotp": True}
            record_failed_attempt(totp_key)
            await log_action(request, "auth.login.2fa_failed", {"login": user.login}, 403)
            raise HTTPException(status_code=403, detail="Invalid 2FA code")
        clear_attempts(login_key, ip_key, rate_limit_key("2fa", client_ip(request), user.login))
        await log_action(request, "auth.login", {"login": user.login})
        token = start_session(user.id)
        _set_session_cookie(response, request, token)
        return {"ok": True}

    record_failed_attempt(login_key)
    record_failed_attempt(ip_key)
    await log_action(request, "auth.login.failed", {"login": body.login.strip()}, 403)
    raise HTTPException(status_code=403, detail="Invalid login or password")


@router.post("/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session", "")
    if token:
        end_session(token)
    await log_action(request, "auth.logout")
    _set_session_cookie(response, request, "", max_age=0)
    return {"ok": True}


@router.get("/security")
async def auth_security(user: models.User = Depends(require_user)):
    return {
        "login": user.login,
        "totpEnabled": bool(user.totp_enabled),
        "hasPendingTotp": bool(user.totp_pending_secret),
    }


@router.post("/password")
async def auth_password(request: Request, body: PasswordBody, db: Session = Depends(get_db), user: models.User = Depends(require_user)):
    if not verify_password(body.currentPassword, user.password_hash, user.password_salt):
        raise HTTPException(status_code=403, detail="Invalid current password")
    if body.newPassword != body.passwordRepeat:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    try:
        update_password(db, user, body.newPassword)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    await log_action(request, "auth.password")
    return {"ok": True}


@router.post("/2fa/setup")
async def auth_2fa_setup(request: Request, body: TotpBody, db: Session = Depends(get_db), user: models.User = Depends(require_user)):
    if not verify_password(body.currentPassword, user.password_hash, user.password_salt):
        raise HTTPException(status_code=403, detail="Invalid current password")
    secret = generate_totp_secret()
    user.totp_pending_secret = secret
    user.updated_at = now_iso()
    db.commit()
    await log_action(request, "auth.2fa.setup")
    meta = get_meta(db)
    return {"secret": secret, "otpauthUrl": totp_provisioning_uri(secret, user.login, meta["siteTitle"])}


@router.post("/2fa/enable")
async def auth_2fa_enable(request: Request, body: TotpBody, db: Session = Depends(get_db), user: models.User = Depends(require_user)):
    if not verify_password(body.currentPassword, user.password_hash, user.password_salt):
        raise HTTPException(status_code=403, detail="Invalid current password")
    secret = user.totp_pending_secret or ""
    if not secret:
        raise HTTPException(status_code=400, detail="2FA setup is not started")
    if not verify_totp(secret, body.token):
        raise HTTPException(status_code=403, detail="Invalid 2FA code")
    user.totp_secret = secret
    user.totp_pending_secret = ""
    user.totp_enabled = 1
    user.updated_at = now_iso()
    db.commit()
    await log_action(request, "auth.2fa.enable")
    return {"ok": True}


@router.post("/2fa/disable")
async def auth_2fa_disable(request: Request, body: TotpBody, db: Session = Depends(get_db), user: models.User = Depends(require_user)):
    if not verify_password(body.currentPassword, user.password_hash, user.password_salt):
        raise HTTPException(status_code=403, detail="Invalid current password")
    if user.totp_enabled and not verify_totp(user.totp_secret, body.token):
        raise HTTPException(status_code=403, detail="Invalid 2FA code")
    user.totp_secret = ""
    user.totp_pending_secret = ""
    user.totp_enabled = 0
    user.updated_at = now_iso()
    db.commit()
    await log_action(request, "auth.2fa.disable")
    return {"ok": True}
