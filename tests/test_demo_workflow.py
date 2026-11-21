from fastapi.testclient import TestClient
from app import create_demo_app


def test_tamper_simulation_leaves_saved_audit_and_review_usable(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    with TestClient(create_demo_app(tmp_path / "db.sqlite3")) as client:
        client.auth = ("demo", "test-only")
        listing = client.get("/v1/demo/scenarios").json()["L1"]
        result = client.post("/v1/verifications", json=listing).json()
        path = f"/demo/tamper/{result['id']}"
        assert client.post(path, json={"chain_hash": "0" * 64}).status_code == 409
        preview = client.post(path, json={"chain_hash": result["chain_hash"]}).raise_for_status().json()
        assert preview == {"valid": False, "broken_at": 0}
        assert client.get("/v1/audit/" + result["id"]).json()["valid"]
        assert client.get("/v1/verifications/" + result["id"]).json() == result
        assert client.post("/v1/verifications/" + result["id"] + "/review", json={
            "chain_hash": result["chain_hash"], "decision": "deny", "note": "Demo review",
        }).status_code == 200


def test_widget_reports_unknown_and_review_rejects_corrupt_audit(tmp_path, monkeypatch, corrupt_saved_audit):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    database = tmp_path / "db.sqlite3"
    with TestClient(create_demo_app(database)) as client:
        client.auth = ("demo", "test-only")
        listing = client.get("/v1/demo/scenarios").raise_for_status().json()["L2"]
        result = client.post("/v1/verifications", json=listing).raise_for_status().json()
        verification_id = result["id"]
        widget_url = f"/v1/widgets/{verification_id}"
        assert client.get(widget_url).raise_for_status().json()["status"] == "APPROVED"

        corrupt_saved_audit(database, verification_id)
        response = client.post(f"/v1/verifications/{verification_id}/review", json={
            "chain_hash": result["chain_hash"], "decision": "deny", "note": "Demo review",
        })
        assert response.status_code == 409
        widget = client.get(widget_url).raise_for_status().json()
        assert widget["status"] == "UNKNOWN"
        report = client.get(widget["report_url"]).raise_for_status().json()
        assert report["status"] == "APPROVED"
        assert report["audit"]["valid"] is False


def test_configured_reviewer_role_protects_queue_decisions_and_agency_data(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    monkeypatch.setenv("TRUSTCART_REVIEWER_PASSWORD", "review-test-only")
    with TestClient(create_demo_app(tmp_path / "db.sqlite3")) as client:
        client.auth = ("demo", "test-only")
        listing = client.get("/v1/demo/scenarios").raise_for_status().json()["L1"]
        result = client.post("/v1/verifications", json=listing).raise_for_status().json()
        path = f"/v1/verifications/{result['id']}"
        review = {"chain_hash": result["chain_hash"], "decision": "deny", "note": "Synthetic mismatch"}
        for protected_read in ("/v1/review-queue", "/v1/agency/summary"):
            assert client.get(protected_read).status_code == 403
            assert client.get(protected_read, auth=("reviewer", "test-only")).status_code == 401
        assert client.post(f"{path}/review", json=review).status_code == 403
        assert client.get(path).raise_for_status().json() == result

        client.auth = ("reviewer", "review-test-only")
        assert client.get("/v1/review-queue").raise_for_status().json()[0]["id"] == result["id"]
        assert client.get("/v1/agency/summary").raise_for_status().json()["total"] == 1
        reviewed = client.post(f"{path}/review", json=review).raise_for_status().json()
        assert reviewed["status"] == "DENIED"
        assert '"actor": "reviewer"' in reviewed["trace"][-1]["outcome"]


def test_reusing_the_demo_password_does_not_enable_reviewer_access(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    monkeypatch.setenv("TRUSTCART_REVIEWER_PASSWORD", "test-only")
    with TestClient(create_demo_app(tmp_path / "db.sqlite3")) as client:
        assert client.get("/v1/review-queue", auth=("demo", "test-only")).status_code == 403
        assert client.get("/v1/review-queue", auth=("reviewer", "test-only")).status_code == 401


def test_browser_writes_require_same_origin_when_origin_is_known(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    with TestClient(create_demo_app(tmp_path / "db.sqlite3")) as client:
        client.auth = ("demo", "test-only")
        listing = client.get("/v1/demo/scenarios").raise_for_status().json()["L1"]
        path = "/v1/verifications"
        for headers in (
            {"Sec-Fetch-Site": "cross-site"},
            {"Sec-Fetch-Site": "same-site"},
            {"Origin": "https://different.example"},
            {"Origin": "null"},
        ):
            assert client.post(path, json=listing, headers=headers).status_code == 403
        assert client.get("/v1/review-queue").raise_for_status().json() == []
        assert client.get("/docs", headers={"Sec-Fetch-Site": "cross-site"}).status_code == 200
        for headers in ({}, {"Origin": "http://testserver"}, {"Sec-Fetch-Site": "same-origin"}):
            assert client.post(path, json=listing, headers=headers).status_code == 201


def test_seller_mutations_cannot_replace_a_completed_reviewer_decision(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    monkeypatch.setenv("TRUSTCART_REVIEWER_PASSWORD", "review-test-only")
    with TestClient(create_demo_app(tmp_path / "db.sqlite3")) as client:
        client.auth = ("demo", "test-only")
        listing = client.get("/v1/demo/scenarios").raise_for_status().json()["L1"]
        result = client.post("/v1/verifications", json=listing).raise_for_status().json()
        path = f"/v1/verifications/{result['id']}"
        reviewed = client.post(f"{path}/review", auth=("reviewer", "review-test-only"), json={
            "chain_hash": result["chain_hash"], "decision": "deny", "note": "Synthetic mismatch",
        }).raise_for_status().json()

        revision = {"chain_hash": reviewed["chain_hash"]}
        assert client.post(f"{path}/recheck", json=revision).status_code == 409
        declarations = {key: listing[key] for key in ("product_name", "license_holder", "registration_reference")}
        assert client.post(
            f"{path}/evidence", data={**declarations, **revision},
            files={"label": ("label.txt", b"label"), "certificate": ("certificate.txt", b"certificate")},
        ).status_code == 409
        assert client.get(path).raise_for_status().json() == reviewed
