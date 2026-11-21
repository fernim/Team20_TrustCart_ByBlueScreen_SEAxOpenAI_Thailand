import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.registry import demo_listings


@pytest.mark.parametrize("attributes,status", [({"registry_source": "unsupported"}, "UNKNOWN"), ({}, "APPROVED")])
def test_reviewer_denial_requires_a_conclusive_basis(tmp_path, attributes, status):
    with TestClient(create_app(tmp_path / "review.sqlite3")) as client:
        result = client.post("/v1/verifications", json={**demo_listings()["L2"], **attributes}).raise_for_status().json()
        path = f"/v1/verifications/{result['id']}"
        assert result["status"] == status
        rejected = client.post(f"{path}/review", json={
            "chain_hash": result["chain_hash"], "decision": "deny", "note": "A decision was requested",
        })
        assert rejected.status_code == 409
        assert client.get(path).raise_for_status().json() == result
