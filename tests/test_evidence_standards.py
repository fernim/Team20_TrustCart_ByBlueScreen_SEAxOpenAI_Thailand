import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import registry
from backend.app.main import create_app


FIXTURES = json.loads((Path(__file__).resolve().parents[1] / "backend/data/evidence_fixtures.json").read_text())


@pytest.mark.parametrize("fixture_ids,expected", [
    (["E11"], "fail"),
    (["E10"], "pass"),
    (["E9"], "pass"),
    (["E11", "E10"], "pass"),
])
def test_declared_standards_survive_upload_and_recheck(tmp_path, monkeypatch, fixture_ids, expected):
    listing = registry.demo_listings()["L2"]
    standards = ", ".join(FIXTURES[key]["kind"] for key in fixture_ids)
    certificate = "\n".join(FIXTURES[key]["content"] for key in fixture_ids).encode()
    database = tmp_path / "standards.sqlite3"
    with TestClient(create_app(database)) as client:
        initial = client.post("/v1/verifications", json=listing).raise_for_status().json()
        url = "/v1/verifications/" + initial["id"]
        fields = {key: listing[key] for key in ("product_name", "license_holder", "registration_reference")}
        result = client.post(url + "/evidence", data={
            **fields, "chain_hash": initial["chain_hash"], "standards": standards,
        }, files={"label": ("label.txt", b"Synthetic standards label"),
                  "certificate": ("certificate.txt", certificate)}).raise_for_status().json()
        assert next(rule for rule in result["rule_results"] if rule["rule"] == "R-05")["result"] == expected
        assert result["status"] == ("PENDING" if expected == "fail" else "APPROVED")
        if expected == "fail":
            assert result["confidence"] == 0.60 and result["human_review_required"]
        assert result["trace"][:len(initial["trace"])] == initial["trace"]

    with TestClient(create_app(database)) as client:
        rechecked = client.post(url + "/recheck", json={"chain_hash": result["chain_hash"]}).raise_for_status().json()
        assert rechecked["status"] == result["status"]
        report = client.get("/v1/reports/" + result["id"]).raise_for_status().json()
        assert report["audit"]["valid"]
        assert all(item["declarations"]["standards"] == standards for item in report["evidence"])

        def unavailable(reference):
            raise registry.RegistryUnavailable

        monkeypatch.setattr(registry, "tool_registry_lookup", unavailable)
        outage = client.post(url + "/recheck", json={"chain_hash": rechecked["chain_hash"]}).raise_for_status().json()
        assert outage["status"] == "UNKNOWN" and outage["human_review_required"]
