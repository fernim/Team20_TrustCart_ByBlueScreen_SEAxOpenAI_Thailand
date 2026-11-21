import os
import secrets
import pytest
from fastapi.testclient import TestClient
from backend.app.main import create_app


@pytest.fixture
def connected(tmp_path, monkeypatch):
    password = secrets.token_urlsafe(20)
    for name in ("BUYER", "SELLER1", "SELLER2", "REVIEWER"):
        monkeypatch.setenv("TRUSTCART_" + name + "_PASSWORD", password)
    with TestClient(create_app(tmp_path / "connected.sqlite3")) as client:
        yield client, password


def login(client, password, username="seller1"):
    response = client.post(
        "/v1/auth/login", json={"username": username}
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return response.json()


def test_roles_sessions_and_csrf(connected):
    client, password = connected
    assert client.get("/v1/reviewer/submissions").status_code == 401
    assert client.get("/v1/catalog/products").status_code == 200
    login(client, password, "buyer")
    assert client.get("/v1/seller/products").status_code == 403
    login(client, password)
    assert client.get("/v1/reviewer/submissions").status_code == 403
    token = client.headers.pop("X-CSRF-Token")
    assert client.post("/v1/seller/subscription/activate").status_code == 403
    client.headers["X-CSRF-Token"] = token
    assert client.post("/v1/auth/logout").status_code == 200
    assert client.get("/v1/seller/products").status_code == 401


def test_normal_listing_is_optional_and_private_between_shops(connected):
    client, password = connected
    login(client, password)
    created = client.post(
        "/v1/seller/products",
        json={
            "title": "Normal product",
            "category": "supplement",
            "price": "199",
            "stock": 5,
        },
    ).json()
    assert created["verification"] is None
    assert created["workflow"]["stage"] == "NOT_REQUESTED"
    public = client.get("/v1/catalog/products").json()[0]
    assert public["badge_eligible"] is False
    assert "trace" not in str(public) and "license_holder" not in public["listing"]
    assert (
        client.post(
            "/v1/seller/products/" + created["id"] + "/submissions",
            json={"expected_version": 1},
        ).status_code
        == 403
    )
    login(client, password, "seller2")
    assert client.get("/v1/seller/products").json() == []
    assert client.get("/v1/seller/products/" + created["id"]).status_code == 404
    assert (
        client.put(
            "/v1/seller/products/" + created["id"],
            json={"title": "Stolen", "price": "1", "expected_version": 1},
        ).status_code
        == 404
    )


def test_hosted_entrypoint_uses_role_sessions_without_shared_gate(
    tmp_path, monkeypatch
):
    from app import create_demo_app

    password = secrets.token_urlsafe(20)
    monkeypatch.setenv("TRUSTCART_SELLER1_PASSWORD", password)
    monkeypatch.delenv("TRUSTCART_DEMO_PASSWORD", raising=False)
    with TestClient(create_demo_app(tmp_path / "hosted.sqlite3")) as client:
        assert client.get("/").status_code == 200
        login(client, password)
        assert client.get("/v1/seller/products").status_code == 200
        assert client.get("/v1/reviewer/submissions").status_code == 403


def test_demo_role_selection_needs_no_password(connected, monkeypatch):
    client, _ = connected
    for role in ('BUYER', 'SELLER1', 'SELLER2', 'REVIEWER'):
        monkeypatch.delenv('TRUSTCART_' + role + '_PASSWORD', raising=False)
    for account in ('buyer', 'seller1', 'seller2', 'reviewer'):
        response = client.post('/v1/auth/login', json={'username': account})
        assert response.status_code == 200
        assert response.json()['id'] == account
        assert response.json()['csrf_token']
    assert client.post('/v1/auth/login', json={'username': 'administrator'}).status_code == 401
    assert 'id="password"' not in client.get('/login').text
