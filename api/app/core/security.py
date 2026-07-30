"""Password hashing + TOTP primitives.

Password hashing is byte-for-byte compatible with server.js's
`hashPassword`/`verifyPassword` (PBKDF2-HMAC-SHA512, 210_000 iterations,
64-byte digest, hex salt+hash) so existing `users` rows keep authenticating
after cutover without a password reset.

TOTP switches to `pyotp` instead of the hand-rolled HMAC-SHA1 implementation
— same otpauth:// URI shape and same ±1 step (30s) tolerance window, so
already-enrolled authenticator apps keep working unchanged.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

import pyotp

PBKDF2_ITERATIONS = 210_000
PBKDF2_DKLEN = 64


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    # Node's crypto.pbkdf2Sync(password, salt, ...) takes `salt` as a JS
    # string, which Node encodes as UTF-8 text bytes by default — NOT as
    # hex-decoded bytes, even though `salt` itself happens to look like hex.
    # bytes.fromhex(salt) here would silently produce a different digest for
    # every existing user row (16 raw bytes vs. 32 ASCII-text bytes).
    digest = hashlib.pbkdf2_hmac("sha512", password.encode(), salt.encode("utf-8"), PBKDF2_ITERATIONS, dklen=PBKDF2_DKLEN)
    return digest.hex(), salt


def verify_password(password: str, password_hash: str, password_salt: str) -> bool:
    candidate, _ = hash_password(password, password_salt)
    return hmac.compare_digest(candidate, password_hash)


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def totp_provisioning_uri(secret: str, login: str, issuer: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=login, issuer_name=issuer)


def verify_totp(secret: str, token: str) -> bool:
    clean = "".join(token.split())
    if not secret or not clean.isdigit() or len(clean) != 6:
        return False
    return pyotp.totp.TOTP(secret).verify(clean, valid_window=1)
