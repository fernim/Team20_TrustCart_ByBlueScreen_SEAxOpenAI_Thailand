from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app.registry import demo_listings


def test_aggregate_reconciles_stored_results(tmp_path):
    with TestClient(create_app(tmp_path / "db.sqlite3")) as client:
        for key in ("L1", "L2", "L4"):
            assert client.post("/v1/verifications", json=demo_listings()[key]).status_code == 201
        response = client.get("/v1/agency/summary")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert sum(data["statuses"].values()) == 3
        assert sum(data["by_category"].values()) == 3
        assert sum(data["by_day"].values()) == 3
        assert data["silent_passes"] == 0
        assert data["valid_audits"] == 3
        assert data["synthetic"]
        assert "license_holder" not in response.text
