"""In-memory session store + auth rate limiting — same shape as server.js's
module-level `sessions`/`authAttempts` Maps. Single-process app (same as
today), so no need for Redis/DB-backed sessions; a restart just logs
everyone out, same as it does today.
"""

from __future__ import annotations

import secrets
import time
from dataclasses import dataclass, field

SESSION_MAX_AGE_SECONDS = 2_592_000
AUTH_RATE_WINDOW_SECONDS = 15 * 60
AUTH_RATE_MAX_ATTEMPTS = 8
TOTP_RATE_MAX_ATTEMPTS = 6


@dataclass
class Session:
    user_id: str
    expires_at: float


@dataclass
class RateEntry:
    count: int = 0
    reset_at: float = field(default_factory=lambda: time.time() + AUTH_RATE_WINDOW_SECONDS)


_sessions: dict[str, Session] = {}
_auth_attempts: dict[str, RateEntry] = {}


def start_session(user_id: str) -> str:
    token = secrets.token_hex(32)
    _sessions[token] = Session(user_id=user_id, expires_at=time.time() + SESSION_MAX_AGE_SECONDS)
    return token


def resolve_session(token: str) -> Session | None:
    session = _sessions.get(token)
    if not session:
        return None
    if session.expires_at <= time.time():
        _sessions.pop(token, None)
        return None
    return session


def end_session(token: str) -> None:
    _sessions.pop(token, None)


def invalidate_user_sessions(user_id: str) -> None:
    for token, session in list(_sessions.items()):
        if session.user_id == user_id:
            _sessions.pop(token, None)


def rate_limit_key(scope: str, ip: str, identifier: str = "") -> str:
    return f"{scope}:{ip}:{identifier.strip().lower()}"


def check_rate_limit(key: str, limit: int = AUTH_RATE_MAX_ATTEMPTS) -> bool:
    now = time.time()
    entry = _auth_attempts.get(key)
    if not entry or entry.reset_at <= now:
        _auth_attempts[key] = RateEntry()
        return True
    return entry.count < limit


def record_failed_attempt(key: str) -> None:
    now = time.time()
    entry = _auth_attempts.get(key)
    if not entry or entry.reset_at <= now:
        _auth_attempts[key] = RateEntry(count=1)
    else:
        entry.count += 1


def clear_attempts(*keys: str) -> None:
    for key in keys:
        _auth_attempts.pop(key, None)


def cleanup_expired() -> None:
    now = time.time()
    for token, session in list(_sessions.items()):
        if session.expires_at <= now:
            _sessions.pop(token, None)
    for key, entry in list(_auth_attempts.items()):
        if entry.reset_at <= now:
            _auth_attempts.pop(key, None)
