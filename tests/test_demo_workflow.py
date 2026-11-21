from fastapi.testclient import TestClient
from app import create_demo_app


def test_demo_tamper_is_detected_and_blocks_review(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    with TestClient(create_demo_app(tmp_path / "db.sqlite3")) as client:
        client.auth = ("demo", "test-only")
        listing = client.get("/v1/demo/scenarios").json()["L1"]
        result = client.post("/v1/verifications", json=listing).json()
        response = client.post("/demo/tamper/" + result["id"], json={"chain_hash": result["chain_hash"]})
        assert response.status_code == 200
        assert not client.get("/v1/audit/" + result["id"]).json()["valid"]
        assert client.post("/v1/verifications/" + result["id"] + "/review", json={
            "chain_hash": result["chain_hash"], "decision": "deny", "note": "Demo review",
        }).status_code == 409
