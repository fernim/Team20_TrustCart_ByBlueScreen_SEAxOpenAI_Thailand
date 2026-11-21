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


def test_openapi_documents_the_verification_and_review_workflow(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    with TestClient(create_demo_app(tmp_path / "demo.sqlite3")) as client:
        schema = client.get("/openapi.json", auth=("demo", "test-only")).raise_for_status().json()
    paths = schema["paths"]
    assert "40 synthetic listing fixtures" in paths["/v1/demo/scenarios"]["get"]["description"]
    assert "/v1/agency/summary" in schema["info"]["description"]
    assert paths["/v1/agency/summary"]["get"]["tags"] == ["Agency"]
    verification = "/v1/verifications/{verification_id}"
    submission = paths["/v1/verifications"]["post"]
    assert submission["responses"]["201"]["headers"]["Location"]["schema"]["type"] == "string"

    upload = paths[f"{verification}/evidence"]["post"]
    assert {"200", "404", "409", "413", "422"} <= upload["responses"].keys()
    body = upload["requestBody"]["content"]["multipart/form-data"]["schema"]
    evidence = schema["components"]["schemas"][body["$ref"].rsplit("/", 1)[-1]]
    for field in ("registration_reference", "product_name", "license_holder"):
        assert evidence["properties"][field]["minLength"] == 1
    for field in ("label", "certificate"):
        assert "2 MiB" in evidence["properties"][field]["description"]
    for action in ("recheck", "review"):
        assert {"200", "404", "409", "422"} <= paths[f"{verification}/{action}"]["post"]["responses"].keys()
    assert "latest" in schema["components"]["schemas"]["Revision"]["properties"]["chain_hash"]["description"]
