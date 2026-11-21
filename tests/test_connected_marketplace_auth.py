import hashlib
import json
import secrets
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import create_demo_app
from backend.app.demo_cases import document
from backend.app.main import create_app


@pytest.fixture
def marketplace_clients(monkeypatch):
    clients = {
        "first": {"secret": secrets.token_urlsafe(32), "shop_id": "shop1", "scopes": ["seller:read", "seller:write"]},
        "second": {"secret": secrets.token_urlsafe(32), "shop_id": "shop2", "scopes": ["seller:read", "seller:write"]},
    }
    monkeypatch.setenv("TRUSTCART_MARKETPLACE_CLIENTS", json.dumps(clients))
    return clients


def token(client, clients, client_id="first", scope=None):
    form = {"grant_type": "client_credentials"}
    if scope is not None:
        form["scope"] = scope
    return client.post("/oauth/token", auth=(client_id, clients[client_id]["secret"]), data=form)


def bearer(token_response):
    return {"Authorization": f"Bearer {token_response.raise_for_status().json()['access_token']}"}


def test_oauth_is_off_without_config_and_rejects_invalid_grants(tmp_path, monkeypatch, marketplace_clients):
    with TestClient(create_app(tmp_path / "oauth.sqlite3")) as client:
        bad_credentials = client.post(
            "/oauth/token", auth=("first", secrets.token_urlsafe(32)), data={"grant_type": "client_credentials"},
        )
        assert bad_credentials.status_code == 401
        assert bad_credentials.json() == {"error": "invalid_client"}
        assert bad_credentials.headers["www-authenticate"].startswith("Basic")
        bad_scope = token(client, marketplace_clients, scope="seller:review")
        assert bad_scope.status_code == 400 and bad_scope.json() == {"error": "invalid_scope"}
        client_auth = ("first", marketplace_clients["first"]["secret"])
        bad_grant = client.post("/oauth/token", auth=client_auth, data={"grant_type": "refresh_token"})
        assert bad_grant.status_code == 400 and bad_grant.json() == {"error": "unsupported_grant_type"}
        bad_body = client.post("/oauth/token", auth=client_auth, json={"grant_type": "client_credentials"})
        assert bad_body.status_code == 400 and bad_body.json() == {"error": "invalid_request"}
        monkeypatch.delenv("TRUSTCART_MARKETPLACE_CLIENTS")
        assert token(client, marketplace_clients).status_code == 503


def test_scoped_tokens_are_short_lived_and_hashed_at_rest(tmp_path, marketplace_clients):
    database = tmp_path / "oauth.sqlite3"
    with TestClient(create_app(database)) as client:
        issued = token(client, marketplace_clients, scope="seller:read").raise_for_status()
        value = issued.json().pop("access_token")
        assert issued.json() == {
            "access_token": value, "token_type": "Bearer", "expires_in": 900, "scope": "seller:read",
        }
        assert issued.headers["cache-control"] == "no-store" and issued.headers["pragma"] == "no-cache"
        headers = bearer(issued)
        assert client.get("/v1/seller/products", headers=headers).status_code == 200
        inadequate = client.post("/v1/seller/products", headers=headers, json={"title": "Listing", "price": "99.00"})
        assert inadequate.status_code == 403
        assert 'scope="seller:write"' in inadequate.headers["www-authenticate"]

        with sqlite3.connect(database) as connection:
            digest = hashlib.sha256(value.encode()).hexdigest()
            row = connection.execute("SELECT id, client_id, shop_id, scope FROM tc_marketplace_tokens").fetchone()
            assert row == (digest, "first", "shop1", "seller:read")
            connection.execute("UPDATE tc_marketplace_tokens SET expires_at=0 WHERE id=?", (digest,))
        for invalid in (headers, {"Authorization": "Bearer " + secrets.token_urlsafe(32)}):
            rejected = client.get("/v1/seller/products", headers=invalid)
            assert rejected.status_code == 401 and rejected.json() == {"error": "invalid_token"}


def test_machine_uses_current_shop_ownership_and_audited_actor(tmp_path, monkeypatch, marketplace_clients):
    password = secrets.token_urlsafe(20)
    monkeypatch.setenv("TRUSTCART_SELLER1_PASSWORD", password)
    with TestClient(create_app(tmp_path / "oauth.sqlite3")) as client:
        session = client.post("/v1/auth/login", json={"username": "seller1", "password": password}).raise_for_status().json()
        client.post("/v1/seller/subscription/activate", headers={"X-CSRF-Token": session["csrf_token"]}).raise_for_status()
        client.cookies.clear()

        first = bearer(token(client, marketplace_clients))
        second = bearer(token(client, marketplace_clients, "second"))
        listing = {"title": "Synthetic marketplace listing", "price": "99.00"}
        product = client.post("/v1/seller/products", headers=first, json=listing).raise_for_status().json()
        product_url = f"/v1/seller/products/{product['id']}"
        assert product["shop_id"] == "shop1"
        second_product = client.post("/v1/seller/products", headers=second, json=listing).raise_for_status().json()
        assert second_product["shop_id"] == "shop2"
        assert [row["id"] for row in client.get("/v1/seller/products", headers=second).raise_for_status().json()] == [second_product["id"]]
        assert client.get(product_url, headers=second).status_code == 404
        assert client.put(product_url, headers=second, json={**listing, "expected_version": 1}).status_code == 404

        submission = client.post(
            f"{product_url}/submissions", headers=first, json={"expected_version": product["version"]},
        ).raise_for_status().json()
        assert json.loads(submission["trace"][0]["outcome"])["actor"] == "marketplace:first"
        submission_url = f"/v1/seller/submissions/{submission['id']}"
        raw = document("clean", "label")
        uploaded = client.post(
            f"{submission_url}/documents", headers=first, data={"kind": "label", "chain_hash": submission["chain_hash"]},
            files={"file": ("label.pdf", raw, "application/pdf")},
        ).raise_for_status().json()
        document_url = f"/v1/documents/{uploaded['documents'][0]['id']}"
        assert client.get(document_url, headers=first).raise_for_status().content == raw
        assert client.get(document_url, headers=second).status_code == 404
        assert client.get(submission_url, headers=second).status_code == 404
        assert client.get(f"{product_url}/history", headers=first).raise_for_status().json()[0]["id"] == submission["id"]

        for method, path in (
            ("GET", "/v1/reviewer/submissions"), ("GET", "/v1/seller/demo-cases"),
            ("POST", "/v1/seller/subscription/activate"), ("GET", "/v1/auth/me"),
            ("POST", "/v1/auth/logout"), ("POST", "/v1/verifications"),
        ):
            assert client.request(method, path, headers=first).status_code == 403

        client.post("/v1/auth/login", json={"username": "seller1", "password": password}).raise_for_status()
        assert client.post("/v1/seller/products", headers=first, json=listing).status_code == 400
        assert client.post("/v1/seller/products", json=listing).status_code == 403


def test_hosted_token_endpoint_runs_without_legacy_basic_gate(tmp_path, monkeypatch, marketplace_clients):
    monkeypatch.delenv("TRUSTCART_DEMO_PASSWORD", raising=False)
    with TestClient(create_demo_app(tmp_path / "oauth.sqlite3")) as client:
        headers = bearer(token(client, marketplace_clients))
        assert client.get("/v1/seller/products", headers=headers).status_code == 200
        assert client.get("/v1/seller/products").status_code == 401
        assert client.get("/v1/reviewer/submissions", headers=headers).status_code == 403


def test_marketplace_configuration_requires_verified_browser_role_sessions(tmp_path, monkeypatch, marketplace_clients):
    monkeypatch.delenv("TRUSTCART_MARKETPLACE_CLIENTS")
    with TestClient(create_app(tmp_path / "oauth.sqlite3")) as client:
        passwordless = {"username": "seller1"}
        client.post("/v1/auth/login", json=passwordless).raise_for_status()
        assert client.get("/v1/seller/products").status_code == 200

        monkeypatch.setenv("TRUSTCART_MARKETPLACE_CLIENTS", json.dumps(marketplace_clients))
        assert client.get("/v1/seller/products").status_code == 401
        assert client.post("/v1/auth/login", json=passwordless).status_code == 401
        assert client.post("/v1/auth/login", json={"username": "reviewer"}).status_code == 401

        password = secrets.token_urlsafe(24)
        monkeypatch.setenv("TRUSTCART_SELLER1_PASSWORD", password)
        assert client.post(
            "/v1/auth/login", json={**passwordless, "password": secrets.token_urlsafe(24)},
        ).status_code == 401
        session = client.post(
            "/v1/auth/login", json={**passwordless, "password": password},
        ).raise_for_status().json()
        assert client.get("/v1/seller/products").status_code == 200
        assert client.get("/v1/reviewer/submissions").status_code == 403
        assert client.post("/v1/seller/subscription/activate").status_code == 403
        assert client.post(
            "/v1/seller/subscription/activate", headers={"X-CSRF-Token": session["csrf_token"]},
        ).status_code == 200
