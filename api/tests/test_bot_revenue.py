"""Bot revenue — unconfigured Bedolaga (the state this test suite always
runs in, since DATA_DIR is a fresh temp dir with no BEDOLAGA_API_URL/KEY
and SEED_DEMO_DATA=false) must degrade gracefully, not error.
"""

from __future__ import annotations


def test_bot_revenue_unconfigured_returns_empty_shape(auth_client):
    response = auth_client.get("/api/bot/revenue")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False
    assert body["totalRub"] == 0
    assert body["items"] == []


def test_bot_revenue_monthly_empty_when_unconfigured(auth_client):
    response = auth_client.get("/api/bot/revenue/monthly")
    assert response.status_code == 200
    assert response.json() == {"months": []}
