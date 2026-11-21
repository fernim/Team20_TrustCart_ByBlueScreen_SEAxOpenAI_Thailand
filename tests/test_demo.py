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
