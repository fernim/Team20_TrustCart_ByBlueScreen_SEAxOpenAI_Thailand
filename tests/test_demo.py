from importlib import import_module

from fastapi.testclient import TestClient

from app import create_demo_app


def test_demo_gate_and_transactions(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    with TestClient(create_demo_app(tmp_path / "demo.sqlite3")) as client:
        for route in ("/", "/v1/demo/transactions", "/docs", "/openapi.json"):
            assert client.get(route).status_code == 401
        assert client.get("/", auth=("demo", "wrong")).status_code == 401
        auth = ("demo", "test-only")
        assert "TrustCart" in client.get("/", auth=auth).text
        response = client.get("/v1/demo/transactions", auth=auth)
        assert response.headers["cache-control"] == "no-store"
        records = response.json()
        assert len(records) == len({row["id"] for row in records}) == 20
        assert {row["status"] for row in records} == {"APPROVED", "PENDING", "DENIED", "UNKNOWN"}
        assert all(row["human_review_required"] for row in records if row["status"] == "UNKNOWN")
        assert all(row["trace"][-1]["chain_hash"] == row["chain_hash"] for row in records)
        assert all(row["rule_results"] for row in records)
        offline = client.get("/v1/demo/transactions?offline=true", auth=auth).json()
        assert all(row["status"] == "UNKNOWN" and row["human_review_required"] for row in offline)
        schema = client.get("/openapi.json", auth=auth).json()
        assert schema["components"]["schemas"]["Listing"]["example"]
        result = client.post("/v1/verifications", auth=auth, json={
            "registration_reference": "DEMO-001", "product_name": "Demo Supplement",
            "license_holder": "Demo Brand", "category": "supplement",
        })
        assert result.status_code == 201
        assert client.get(result.headers["location"], auth=auth).json() == result.json()


def test_demo_fails_closed_without_password(tmp_path, monkeypatch):
    monkeypatch.delenv("TRUSTCART_DEMO_PASSWORD", raising=False)
    with TestClient(create_demo_app(tmp_path / "demo.sqlite3")) as client:
        assert client.get("/v1/demo/transactions").status_code == 503


def test_grouped_api_routers_are_registered_behind_demo_gate(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    expected = {
        "verifications": {
            ("POST", "/v1/verifications"),
            ("GET", "/v1/verifications/{verification_id}"),
        },
        "seller": {
            ("POST", "/v1/verifications/{verification_id}/evidence"),
            ("POST", "/v1/verifications/{verification_id}/recheck"),
            ("POST", "/v1/listings/suggest-copy"),
        },
        "reviewer": {
            ("GET", "/v1/review-queue"),
            ("POST", "/v1/verifications/{verification_id}/review"),
        },
        "reports": {
            ("GET", "/v1/audit/{verification_id}"),
            ("GET", "/v1/reports/{verification_id}"),
            ("GET", "/v1/widgets/{verification_id}"),
            ("POST", "/v1/products/compare"),
        },
    }
    with TestClient(create_demo_app(tmp_path / "demo.sqlite3")) as client:
        paths = client.get("/openapi.json", auth=("demo", "test-only")).json()["paths"]
        for module, operations in expected.items():
            router = import_module(f"backend.app.api.{module}").router
            assert {(method, route.path) for route in router.routes for method in route.methods} == operations
            for method, path in operations:
                assert method.lower() in paths[path]
                url = path.replace("{verification_id}", "00000000-0000-0000-0000-000000000000")
                assert client.request(method, url).status_code == 401
