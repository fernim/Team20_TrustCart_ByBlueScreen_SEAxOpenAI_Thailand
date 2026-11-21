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


def test_widget_reports_unknown_after_audit_tampering(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    with TestClient(create_demo_app(tmp_path / "db.sqlite3")) as client:
        client.auth = ("demo", "test-only")
        listing = client.get("/v1/demo/scenarios").raise_for_status().json()["L2"]
        result = client.post("/v1/verifications", json=listing).raise_for_status().json()
        verification_id = result["id"]
        widget_url = f"/v1/widgets/{verification_id}"
        assert client.get(widget_url).raise_for_status().json()["status"] == "APPROVED"

        response = client.post(f"/demo/tamper/{verification_id}", json={"chain_hash": result["chain_hash"]})
        assert response.raise_for_status().json()["valid"] is False
        widget = client.get(widget_url).raise_for_status().json()
        assert widget["status"] == "UNKNOWN"
        report = client.get(widget["report_url"]).raise_for_status().json()
        assert report["status"] == "APPROVED"
        assert report["audit"]["valid"] is False
