"""Regression test for a real bug found during the real-data parity check:
Node's crypto.pbkdf2Sync(password, salt, ...) takes `salt` as a JS string,
which Node encodes as UTF-8 *text* bytes — not as hex-decoded bytes, even
though the salt happens to look like a hex string. An earlier version of
hash_password() used bytes.fromhex(salt), which silently produced a
different digest for every pre-existing `users` row and would have locked
out every real user on cutover. This hash/salt pair was generated for real
by `node -e "crypto.pbkdf2Sync(...)"` — not by our own Python code — so this
test only passes if the two implementations are genuinely byte-compatible.
"""

from __future__ import annotations

from app.core.security import hash_password, verify_password

NODE_GENERATED_PASSWORD = "nodegenerated123"
NODE_GENERATED_SALT = "7d5b76a0dd4e6c94a8894cfba9234b50"


NODE_GENERATED_HASH = (
    "869ba9c2b4aae5049d022881d93c0b52f987929aea6e32eeea8b844f12b7ad9"
    "c4dbe252be2c293bbf2ca15383de36a7d2b5f71710391d932b4a21b3af5ae5c37"
)


def test_verify_password_accepts_a_real_node_generated_hash():
    # Captured live: node -e 'crypto.pbkdf2Sync("nodegenerated123", "7d5b76a0dd4e6c94a8894cfba9234b50", 210000, 64, "sha512")'
    assert verify_password(NODE_GENERATED_PASSWORD, NODE_GENERATED_HASH, NODE_GENERATED_SALT) is True


def test_verify_password_rejects_wrong_password_against_node_hash():
    assert verify_password("wrong-password", NODE_GENERATED_HASH, NODE_GENERATED_SALT) is False


def test_hash_password_salt_is_utf8_text_not_hex_decoded():
    # The salt string itself must be hashed as its literal UTF-8 bytes
    # (32 ASCII bytes for a 32-char hex-looking salt) — not decoded from
    # hex into 16 raw bytes. This is the exact distinction the original bug
    # got backwards.
    digest, salt = hash_password("somepassword", "00000000000000000000000000000000")
    import hashlib

    expected = hashlib.pbkdf2_hmac(
        "sha512", b"somepassword", "00000000000000000000000000000000".encode("utf-8"), 210_000, dklen=64
    ).hex()
    assert digest == expected


def test_hash_then_verify_round_trip():
    digest, salt = hash_password("round-trip-pw")
    assert verify_password("round-trip-pw", digest, salt) is True
    assert verify_password("wrong", digest, salt) is False
