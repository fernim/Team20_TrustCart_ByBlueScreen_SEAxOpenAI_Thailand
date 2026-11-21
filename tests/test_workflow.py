from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app.registry import demo_listings


def test_l1_loop_and_restart(tmp_path):
    database = tmp_path / "db.sqlite3"
    with TestClient(create_app(database)) as client:
        result = client.post("/v1/verifications", json=demo_listings()["L1"]).json()
        path = "/v1/verifications/" + result["id"]
        prior_trace = result["trace"]
        uploaded = client.post(path + "/evidence", data={
            "chain_hash": result["chain_hash"], "product_name": "Turmeric Blend",
            "license_holder": "Other Demo Brand", "registration_reference": "DEMO-001",
        }, files={"label": ("label.txt", b"synthetic label"), "certificate": ("certificate.txt", b"synthetic certificate")})
        assert uploaded.status_code == 200
        result = uploaded.json()
        assert result["confidence"] == 0.6
        assert result["status"] == "PENDING"
        assert result["trace"][:len(prior_trace)] == prior_trace
        assert any(rule["rule"] == "R-05" and rule["result"] == "fail" for rule in result["rule_results"])
        rechecked = client.post(path + "/recheck", json={"chain_hash": result["chain_hash"]})
        assert rechecked.status_code == 200
        current = rechecked.json()
        assert len(current["trace"]) > len(result["trace"])
        assert client.post(path + "/review", json={"chain_hash": result["chain_hash"], "decision": "deny", "note": "Mismatch confirmed"}).status_code == 409
        assert client.get("/v1/review-queue").json()[0]["id"] == result["id"]
        reviewed = client.post(path + "/review", json={"chain_hash": current["chain_hash"], "decision": "deny", "note": "Synthetic mismatch confirmed"})
        assert reviewed.status_code == 200
        assert reviewed.json()["status"] == "DENIED"
        assert client.get("/v1/audit/" + result["id"]).json()["valid"]
        report = client.get("/v1/reports/" + result["id"]).json()
        assert len(report["evidence"]) == 2
        assert report["synthetic"]
        assert client.get("/v1/widgets/" + result["id"]).json()["status"] == "DENIED"
    with TestClient(create_app(database)) as client:
        assert client.get(path).json()["status"] == "DENIED"


def test_review_cannot_approve_outage_or_claim_failure(tmp_path):
    with TestClient(create_app(tmp_path / "db.sqlite3")) as client:
        for scenario in ("L4", "L5"):
            result = client.post("/v1/verifications", json=demo_listings()[scenario]).json()
            response = client.post("/v1/verifications/" + result["id"] + "/review",
                json={"chain_hash": result["chain_hash"], "decision": "approve", "note": "Review"})
            assert response.status_code == 409
