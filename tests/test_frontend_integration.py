from fastapi.testclient import TestClient
from app import create_demo_app
from backend.app.registry import demo_listings


def test_product_api_preserves_released_policy_and_gate(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    with TestClient(create_demo_app(tmp_path / "db.sqlite3")) as client:
        for route in ("/", "/seller", "/reviewer", "/workspace", "/static/app.js", "/v1/products"):
            assert client.get(route).status_code == 401
        client.auth = ("demo", "test-only")
        for key, status in (("L1", "PENDING"), ("L2", "APPROVED"), ("L4", "DENIED"), ("L14", "UNKNOWN")):
            created = client.post("/v1/products", json=demo_listings()[key])
            assert created.status_code == 201
            assert created.json()["verification"]["status"] == status
        product = client.post("/v1/products", json=demo_listings()["L2"]).json()
        verification = product["verification"]
        assert client.post("/demo/tamper/" + verification["id"], json={"chain_hash": verification["chain_hash"]}).status_code == 200
        assert client.get("/v1/products/" + product["id"]).json()["verification"]["status"] == "UNKNOWN"
