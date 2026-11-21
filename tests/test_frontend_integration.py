from fastapi.testclient import TestClient
from app import create_demo_app
from backend.app.registry import demo_listings


def test_product_api_preserves_released_policy_and_gate(tmp_path, monkeypatch, corrupt_saved_audit):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    database = tmp_path / "db.sqlite3"
    with TestClient(create_demo_app(database)) as client:
        for route in ("/workspace", "/v1/products"):
            assert client.get(route).status_code == 401
        client.auth = ("demo", "test-only")
        for key, status in (("L1", "PENDING"), ("L2", "APPROVED"), ("L4", "DENIED"), ("L14", "UNKNOWN")):
            created = client.post("/v1/products", json={**demo_listings()[key], "price": "199.00"})
            assert created.status_code == 201
            assert created.json()["verification"]["status"] == status
        product = client.post("/v1/products", json={**demo_listings()["L2"], "price": "199.00"}).json()
        verification = product["verification"]
        corrupt_saved_audit(database, verification["id"])
        assert client.get("/v1/products/" + product["id"]).json()["verification"]["status"] == "UNKNOWN"
