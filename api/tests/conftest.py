"""Shared fixtures. DATA_DIR is pointed at a fresh temp directory *before*
any app module is imported, so Settings() (lru_cache'd) never sees the real
data directory — this suite must never be able to touch production data,
even by accident.
"""

from __future__ import annotations

import os
import tempfile

import pytest

_tmpdir = tempfile.mkdtemp(prefix="servix-pytest-")
os.environ["DATA_DIR"] = _tmpdir
os.environ["SEED_DEMO_DATA"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def auth_client(client):
    """A client that has completed first-run setup and is logged in.
    Session-scoped: setup can only run once (first user wins), so every
    test that needs auth shares this one client/session, same as a single
    interactive browser session would."""
    response = client.post(
        "/api/auth/setup",
        json={"login": "pytest-admin", "password": "pytest-admin-pw-123", "passwordRepeat": "pytest-admin-pw-123"},
    )
    assert response.status_code == 200, response.text
    return client


@pytest.fixture
def db(client):
    """A raw SQLAlchemy session against the same temp DB — `client` is an
    unused dependency here, just forcing app startup (and its migrations)
    to have already run before this is used standalone."""
    from app.core.db import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
