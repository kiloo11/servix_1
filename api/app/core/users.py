"""User account CRUD/auth primitives — mirrors server.js's userCount/
createUser/authenticate/updatePassword/currentUser.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dates import now_iso
from app.core.security import hash_password, verify_password
from app.core.sessions import invalidate_user_sessions
from app import models


def user_count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(models.User)) or 0


def create_user(db: Session, login: str, password: str) -> models.User:
    login = (login or "").strip()
    if not login:
        raise ValueError("Login is required")
    if len(password or "") < 8:
        raise ValueError("Password must be at least 8 characters")
    now = now_iso()
    password_hash, password_salt = hash_password(password)
    user = models.User(
        id=str(uuid.uuid4()),
        login=login,
        password_hash=password_hash,
        password_salt=password_salt,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, login: str, password: str) -> models.User | None:
    user = db.scalar(select(models.User).where(models.User.login == (login or "").strip()))
    if not user:
        # Constant-time-ish: still do a hash so login-existence isn't timing-leaked.
        hash_password(password or "", "00000000000000000000000000000000")
        return None
    return user if verify_password(password or "", user.password_hash, user.password_salt) else None


def update_password(db: Session, user: models.User, password: str) -> None:
    if len(password or "") < 8:
        raise ValueError("Password must be at least 8 characters")
    password_hash, password_salt = hash_password(password)
    user.password_hash = password_hash
    user.password_salt = password_salt
    user.updated_at = now_iso()
    db.commit()
    invalidate_user_sessions(user.id)
