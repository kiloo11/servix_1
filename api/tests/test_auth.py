"""Auth flow: setup, login, status, password change, logout."""

from __future__ import annotations


def test_status_before_setup_requires_setup(client):
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    body = response.json()
    assert body["authenticated"] is False


def test_setup_already_completed_by_auth_client(auth_client):
    response = auth_client.get("/api/auth/status")
    assert response.status_code == 200
    body = response.json()
    assert body["setupRequired"] is False
    assert body["authenticated"] is True


def test_login_wrong_password_rejected(auth_client):
    # 403, not 401 — matches server.js's sendJson(res, 403, {error: "Invalid login or password"})
    response = auth_client.post("/api/auth/login", json={"login": "pytest-admin", "password": "wrong-password"})
    assert response.status_code == 403
    assert response.json() == {"error": "Invalid login or password"}


def test_login_unknown_user_rejected(auth_client):
    response = auth_client.post("/api/auth/login", json={"login": "nobody", "password": "whatever12345"})
    assert response.status_code == 403


def test_password_change_and_relogin(auth_client):
    response = auth_client.post(
        "/api/auth/password",
        json={"currentPassword": "pytest-admin-pw-123", "newPassword": "pytest-admin-pw-456", "passwordRepeat": "pytest-admin-pw-456"},
    )
    assert response.status_code == 200, response.text

    relogin = auth_client.post("/api/auth/login", json={"login": "pytest-admin", "password": "pytest-admin-pw-456"})
    assert relogin.status_code == 200

    # restore original password so later tests in the suite keep working
    restore = auth_client.post(
        "/api/auth/password",
        json={"currentPassword": "pytest-admin-pw-456", "newPassword": "pytest-admin-pw-123", "passwordRepeat": "pytest-admin-pw-123"},
    )
    assert restore.status_code == 200
    auth_client.post("/api/auth/login", json={"login": "pytest-admin", "password": "pytest-admin-pw-123"})


def test_unauthenticated_data_endpoint_returns_401(client):
    # `client` is session-scoped and shared with auth_client, which may have
    # already logged in by the time this runs — a second TestClient(app)
    # would re-run the startup lifespan and crash on the already-started
    # scheduler singleton, so instead just strip the session cookie for this
    # one call and restore it afterward.
    saved = dict(client.cookies)
    client.cookies.clear()
    try:
        response = client.get("/api/assets")
    finally:
        client.cookies.update(saved)
    assert response.status_code == 401
    assert response.json() == {"error": "Auth required"}
