import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.registry import demo_listings


@pytest.mark.parametrize("blank", ["", "  \n\t"])
def test_identity_only_decision_and_widget_publish_their_scope(tmp_path, blank):
    listing = demo_listings()["L27"]
    with TestClient(create_app(tmp_path / "scope.sqlite3")) as client:
        response = client.post("/v1/verifications", json={**listing, "title": blank, "description": blank})
        result = response.raise_for_status().json()
        assert result["status"] == "APPROVED"
        assert result["verification_scope"] == "identity_category"
        assert next(rule for rule in result["rule_results"] if rule["rule"] == "R-03")["result"] == "skip"
        widget = client.get(f"/v1/widgets/{result['id']}").raise_for_status().json()
        assert widget["verification_scope"] == "identity_category"
        checked = client.post("/v1/verifications", json=listing).raise_for_status().json()
        assert checked["verification_scope"] == "listing"
