import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import create_demo_app
from backend.app.main import create_app
from backend.app.registry import demo_listings


@pytest.mark.parametrize(
    "method,path,expected_fields",
    [
        ("post", "/v1/verifications/{verification_id}/evidence", {"status", "chain_hash", "rule_results"}),
        ("post", "/v1/verifications/{verification_id}/recheck", {"status", "chain_hash", "rule_results"}),
        ("post", "/v1/verifications/{verification_id}/review", {"status", "chain_hash", "rule_results"}),
        ("get", "/v1/reports/{verification_id}", {"status", "evidence", "audit", "risk", "synthetic"}),
        ("get", "/v1/widgets/{verification_id}", {"status", "verification_scope", "label_en", "label_th", "report_url", "synthetic"}),
        ("post", "/v1/products/compare", {"products", "synthetic"}),
    ],
)
def test_openapi_describes_workflow_responses(tmp_path, monkeypatch, method, path, expected_fields):
    monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    with TestClient(create_demo_app(tmp_path / "demo.sqlite3")) as client:
        document = client.get("/openapi.json", auth=("demo", "test-only")).raise_for_status().json()

    response = document["paths"][path][method]["responses"]["200"]["content"]["application/json"]["schema"]
    schemas = document["components"]["schemas"]
    fields = schemas[response["$ref"].rsplit("/", 1)[-1]]["properties"]
    assert expected_fields <= fields.keys()
    if "rule_results" in fields:
        rule = schemas[fields["rule_results"]["items"]["$ref"].rsplit("/", 1)[-1]]
        assert {"rule", "result", "reason_en", "reason_th", "evidence"} <= rule["properties"].keys()
    if "evidence" in fields:
        evidence = schemas[fields["evidence"]["items"]["$ref"].rsplit("/", 1)[-1]]
        assert {"kind", "sha256", "declarations"} == evidence["properties"].keys()


def test_workflow_responses_keep_existing_wire_fields(tmp_path):
    listing = {**demo_listings()["L2"], "price": "199.00"}
    with TestClient(create_app(tmp_path / "demo.sqlite3")) as client:
        initial = client.post("/v1/verifications", json=listing).raise_for_status().json()
        path = f"/v1/verifications/{initial['id']}"
        declarations = {key: listing[key] for key in ("product_name", "license_holder", "registration_reference")}
        files = {"label": ("label.txt", b"synthetic label"), "certificate": ("certificate.txt", b"synthetic certificate")}
        uploaded = client.post(
            f"{path}/evidence", data={**declarations, "chain_hash": initial["chain_hash"]}, files=files,
        ).raise_for_status().json()
        rechecked = client.post(f"{path}/recheck", json={"chain_hash": uploaded["chain_hash"]}).raise_for_status().json()
        reviewed = client.post(f"{path}/review", json={
            "chain_hash": rechecked["chain_hash"], "decision": "approve", "note": "Matching synthetic evidence",
        }).raise_for_status().json()

        for result in (uploaded, rechecked, reviewed):
            assert result.keys() == initial.keys()
            assert result["listing"] == initial["listing"]
            assert result["trace"][-1]["chain_hash"] == result["chain_hash"]
            assert result["listing"]["price"] == "199.00"
        assert client.get(path).raise_for_status().json() == reviewed

        report_url = f"/v1/reports/{initial['id']}"
        report = client.get(report_url).raise_for_status().json()
        assert report.keys() == reviewed.keys() | {"evidence", "audit", "risk", "synthetic"}
        assert report["audit"] == {"valid": True, "broken_at": None}
        assert len(report["evidence"]) == 2
        assert all(item["declarations"] == declarations for item in report["evidence"])
        compare = client.post("/v1/products/compare", json={"ids": [initial["id"]]}).raise_for_status().json()
        assert compare == {"products": [report], "synthetic": True}
        widget = client.get(f"/v1/widgets/{initial['id']}").raise_for_status().json()
        assert widget == {
            "status": "APPROVED", "verification_scope": "listing", "label_en": "Approved",
            "label_th": "ผ่านการตรวจสอบข้อมูลจำลอง",
            "report_url": report_url, "synthetic": True,
        }


def test_report_keeps_missing_legacy_listing_snapshot(tmp_path):
    database = tmp_path / "demo.sqlite3"
    with TestClient(create_app(database)) as client:
        result = client.post("/v1/verifications", json=demo_listings()["L2"]).raise_for_status().json()
        legacy = {key: value for key, value in result.items() if key != "verification_scope"}
        with sqlite3.connect(database) as connection:
            connection.execute(
                "UPDATE verifications SET listing = NULL, result = ? WHERE id = ?",
                (json.dumps(legacy), result["id"]),
            )

        report = client.get(f"/v1/reports/{result['id']}").raise_for_status().json()
        assert report["listing"] is None
        assert report["trace"] == result["trace"]
        assert report["audit"]["valid"] is True
        assert report["verification_scope"] == "listing"
