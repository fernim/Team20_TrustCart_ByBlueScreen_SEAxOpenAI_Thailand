import hashlib
import json

from fastapi.testclient import TestClient
import pytest

from backend.app.main import create_app


@pytest.mark.parametrize(
    "reference,product,category,status",
    [
        ("DEMO-001", "Demo Supplement", "supplement", "APPROVED"),
        ("DEMO-001", "Different Product", "supplement", "DENIED"),
        ("DEMO-001", "Demo Supplement", "other", "UNKNOWN"),
        ("DEMO-001", "Demo Supplement", "cosmetic", "DENIED"),
        ("MISSING", "Demo Supplement", "supplement", "UNKNOWN"),
    ],
)
def test_submit_and_retrieve(tmp_path, reference, product, category, status):
    database = tmp_path / "trustcart.sqlite3"
    payload = {
        "registration_reference": reference,
        "product_name": product,
        "license_holder": "Demo Brand",
        "category": category,
    }
    with TestClient(create_app(database)) as client:
        response = client.post("/v1/verifications", json=payload)
        assert response.status_code == 201
        result = response.json()
        assert result["status"] == status
        assert result["registry_source"] == "synthetic"
        assert result["human_review_required"] == (status == "UNKNOWN")
        previous_hash = None
        for entry in result["trace"]:
            event = {key: value for key, value in entry.items() if key != "chain_hash"}
            assert event["previous_hash"] == previous_hash
            previous_hash = hashlib.sha256(json.dumps(event, sort_keys=True).encode("utf-8")).hexdigest()
            assert entry["chain_hash"] == previous_hash
        assert result["chain_hash"] == previous_hash

    with TestClient(create_app(database)) as client:
        assert client.get(response.headers["location"]).json() == result


def test_registry_outage_routes_to_review(tmp_path, monkeypatch):
    from backend.app import registry

    def unavailable(reference):
        raise registry.RegistryUnavailable

    monkeypatch.setattr(registry, "tool_registry_lookup", unavailable)
    with TestClient(create_app(tmp_path / "trustcart.sqlite3")) as client:
        response = client.post(
            "/v1/verifications",
            json={
                "registration_reference": "DEMO-001",
                "product_name": "Demo Supplement",
                "license_holder": "Demo Brand",
                "category": "supplement",
            },
        )
        assert response.json()["status"] == "UNKNOWN"
        assert response.json()["human_review_required"]
