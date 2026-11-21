from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app.registry import demo_listings


def test_copy_suggestion_is_screened_and_compare_reports(tmp_path):
    with TestClient(create_app(tmp_path / "db.sqlite3")) as client:
        source = demo_listings()["L4"]
        response = client.post("/v1/listings/suggest-copy", json=source)
        assert response.status_code == 200
        suggestion = response.json()
        assert suggestion["screened"]
        assert "prevents" not in suggestion["listing"]["title"]
        verified = client.post("/v1/verifications", json=suggestion["listing"]).json()
        assert verified["status"] == "APPROVED"
        compared = client.post("/v1/products/compare", json={"ids": [verified["id"]]})
        assert compared.status_code == 200
        assert compared.json()["products"][0]["id"] == verified["id"]
