"""Regression tests for the exception-handler precedence bug found during
Phase 1: an in-route 404 (e.g. "unknown asset id") must keep its specific
message, while a genuinely unmatched route gets the generic API-not-found
message — both as `{"error": ...}`, never FastAPI's default `{"detail": ...}`.
"""

from __future__ import annotations


def test_in_route_404_keeps_specific_message(auth_client):
    response = auth_client.put("/api/assets/nonexistent-id-123", json={"type": "vps", "name": "x"})
    assert response.status_code == 404
    assert response.json() == {"error": "Запись не найдена"}


def test_unmatched_route_gets_generic_message(auth_client):
    response = auth_client.get("/api/totally/made/up/route")
    assert response.status_code == 404
    assert response.json() == {"error": "API endpoint не найден"}


def test_validation_error_shape_is_error_not_detail(auth_client):
    response = auth_client.post("/api/providers", json={"name": ""})
    assert response.status_code == 400
    body = response.json()
    assert "error" in body
    assert "detail" not in body


def test_unmatched_non_api_route_falls_through_to_spa_shell(auth_client):
    """A client-side route (e.g. a Next.js page) that isn't a literal file
    under dist/ must fall through to the root SPA shell, not 404 — the
    opposite of the /api/* case above. Guards against over-correcting the
    /api/* fix into rejecting every unmatched path indiscriminately."""
    response = auth_client.get("/some/client-side/route")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
