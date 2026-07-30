"""Due-notifications list (/api/notifications) — timing math regression
coverage for the local-vs-UTC "now" bug found during Phase 1: parse_app_date
interprets naive datetimes as local time (matching server.js's
`new Date(localValue)`), so every "now" used for comparison against it must
also be local, not UTC.
"""

from __future__ import annotations

from datetime import datetime, timedelta


def test_notifications_lists_soon_expiring_asset(auth_client):
    in_two_hours = (datetime.now() + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M")
    asset = auth_client.post("/api/assets", json={"type": "vps", "name": "notif-test-soon", "expiresAt": in_two_hours}).json()

    response = auth_client.get("/api/notifications")
    assert response.status_code == 200
    items = response.json()["items"]
    match = next((item for item in items if item["assetId"] == asset["id"]), None)
    assert match is not None
    # allow a couple of minutes of test-runtime slack either side of 120
    assert 115 <= match["minutesLeft"] <= 121

    auth_client.delete(f"/api/assets/{asset['id']}")


def test_notifications_excludes_far_future_asset(auth_client):
    far_future = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%dT%H:%M")
    asset = auth_client.post("/api/assets", json={"type": "vps", "name": "notif-test-far", "expiresAt": far_future}).json()

    response = auth_client.get("/api/notifications")
    items = response.json()["items"]
    assert not any(item["assetId"] == asset["id"] for item in items)

    auth_client.delete(f"/api/assets/{asset['id']}")


def test_notifications_excludes_inactive_asset(auth_client):
    in_one_hour = (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
    asset = auth_client.post(
        "/api/assets", json={"type": "vps", "name": "notif-test-inactive", "expiresAt": in_one_hour, "inactive": True}
    ).json()

    response = auth_client.get("/api/notifications")
    items = response.json()["items"]
    assert not any(item["assetId"] == asset["id"] for item in items)

    auth_client.delete(f"/api/assets/{asset['id']}")
