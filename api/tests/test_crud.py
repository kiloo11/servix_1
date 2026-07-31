"""Providers/categories/assets CRUD, embedded payments, reorder, settings."""

from __future__ import annotations


def test_provider_create_update_delete(auth_client):
    created = auth_client.post("/api/providers", json={"name": "Hetzner", "color": "#ff6600"})
    assert created.status_code == 201, created.text
    provider = created.json()
    assert provider["name"] == "Hetzner"
    assert provider["color"] == "#ff6600"

    updated = auth_client.put(f"/api/providers/{provider['id']}", json={"name": "Hetzner Cloud", "color": "#ff6600"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Hetzner Cloud"

    deleted = auth_client.delete(f"/api/providers/{provider['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["id"] == provider["id"]

    missing = auth_client.delete(f"/api/providers/{provider['id']}")
    assert missing.status_code == 404
    assert missing.json() == {"error": "Провайдер не найден"}


def test_provider_requires_name(auth_client):
    response = auth_client.post("/api/providers", json={"name": ""})
    assert response.status_code == 400
    assert response.json() == {"error": "Название провайдера обязательно"}


def test_category_crud(auth_client):
    created = auth_client.post("/api/categories", json={"name": "Custom"})
    assert created.status_code == 201
    category = created.json()

    updated = auth_client.put(f"/api/categories/{category['id']}", json={"name": "Custom Renamed"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Custom Renamed"

    deleted = auth_client.delete(f"/api/categories/{category['id']}")
    assert deleted.status_code == 200

    missing = auth_client.delete(f"/api/categories/{category['id']}")
    assert missing.status_code == 404
    assert missing.json() == {"error": "Категория не найдена"}


def test_asset_crud_with_embedded_payments(auth_client):
    provider = auth_client.post("/api/providers", json={"name": "AssetTestProvider"}).json()

    created = auth_client.post(
        "/api/assets",
        json={
            "type": "vps",
            "name": "node-1",
            "providerId": provider["id"],
            "price": 10,
            "priceCurrency": "USDT",
            "payments": [{"amount": 10, "currency": "USDT", "paidAt": "2026-01-01"}],
        },
    )
    assert created.status_code == 201, created.text
    asset = created.json()
    assert asset["providerId"] == provider["id"]
    assert len(asset["payments"]) == 1
    assert asset["payments"][0]["amount"] == 10

    # full-object PUT (matches how the real frontend form submits, not a
    # partial patch — providerId/expiresAt/ip have no previous-value
    # fallback in normalize_asset, faithfully mirroring server.js)
    updated = auth_client.put(
        f"/api/assets/{asset['id']}",
        json={
            "type": "vps",
            "name": "node-1-renamed",
            "providerId": provider["id"],
            "price": 15,
            "priceCurrency": "USDT",
            "payments": asset["payments"],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "node-1-renamed"
    assert updated.json()["price"] == 15

    bulk = auth_client.get("/api/assets").json()
    assert any(a["id"] == asset["id"] for a in bulk["assets"])

    deleted = auth_client.delete(f"/api/assets/{asset['id']}")
    assert deleted.status_code == 200

    missing_put = auth_client.put(f"/api/assets/{asset['id']}", json={"type": "vps", "name": "x"})
    assert missing_put.status_code == 404
    assert missing_put.json() == {"error": "Запись не найдена"}

    auth_client.delete(f"/api/providers/{provider['id']}")


def test_asset_description_round_trip(auth_client):
    created = auth_client.post("/api/assets", json={"type": "domain", "name": "example.test", "description": "  Registered for the staging environment  "})
    assert created.status_code == 201, created.text
    asset = created.json()
    assert asset["description"] == "Registered for the staging environment"

    updated = auth_client.put(f"/api/assets/{asset['id']}", json={"type": "domain", "name": "example.test", "description": ""})
    assert updated.status_code == 200
    assert updated.json()["description"] == ""

    bulk = auth_client.get("/api/assets").json()
    row = next(a for a in bulk["assets"] if a["id"] == asset["id"])
    assert row["description"] == ""

    auth_client.delete(f"/api/assets/{asset['id']}")


def test_asset_requires_name(auth_client):
    response = auth_client.post("/api/assets", json={"type": "vps", "name": ""})
    assert response.status_code == 400
    assert response.json() == {"error": "Название обязательно"}


def test_asset_reorder(auth_client):
    ids = []
    for i in range(3):
        asset = auth_client.post("/api/assets", json={"type": "domain", "name": f"reorder-{i}.example.com"}).json()
        ids.append(asset["id"])

    reversed_ids = list(reversed(ids))
    response = auth_client.post("/api/assets/reorder", json={"type": "domain", "inactive": False, "ids": reversed_ids})
    assert response.status_code == 200
    returned_ids = [a["id"] for a in response.json()["assets"] if a["id"] in ids]
    assert returned_ids == reversed_ids

    for asset_id in ids:
        auth_client.delete(f"/api/assets/{asset_id}")


def test_settings_update_round_trip(auth_client):
    response = auth_client.put(
        "/api/settings",
        json={"siteTitle": "Pytest Panel", "locale": "ru", "timezone": "Europe/Moscow", "currency": "EUR"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["siteTitle"] == "Pytest Panel"
    assert body["currency"] == "EUR"

    # restore a known-good state for later tests
    auth_client.put(
        "/api/settings",
        json={"siteTitle": "SERVIX", "locale": "ru", "timezone": "Europe/Moscow", "currency": "USDT"},
    )


def test_settings_rejects_invalid_timezone(auth_client):
    response = auth_client.put(
        "/api/settings",
        json={"siteTitle": "X", "locale": "ru", "timezone": "Not/ATimezone", "currency": "USDT"},
    )
    assert response.status_code == 400
