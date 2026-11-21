import hashlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import registry
from backend.app.main import create_app


DUPLICATE = json.loads((Path(__file__).resolve().parents[1] / "backend/data/evidence_fixtures.json").read_text())["E16"]["content"].encode()


def upload(client, result, contents):
    listing = registry.demo_listings()["L2"]
    fields = {key: listing[key] for key in ("product_name", "license_holder", "registration_reference")}
    return client.post("/v1/verifications/" + result["id"] + "/evidence",
                       data={**fields, "chain_hash": result["chain_hash"]},
                       files={kind: (kind + ".txt", value) for kind, value in contents.items()})


@pytest.mark.parametrize("kind", ["label", "certificate"])
def test_cross_verification_duplicate_routes_to_review_and_survives_recheck(tmp_path, monkeypatch, kind):
    database = tmp_path / "duplicate.sqlite3"
    with TestClient(create_app(database)) as client:
        first = client.post("/v1/verifications", json=registry.demo_listings()["L2"]).json()
        assert upload(client, first, {"label": b"First label", "certificate": DUPLICATE}).status_code == 200
        second = client.post("/v1/verifications", json=registry.demo_listings()["L2"]).json()
        contents = {"label": b"Second label", "certificate": b"Second certificate", kind: DUPLICATE}
        result = upload(client, second, contents).raise_for_status().json()
        assert result["status"] == "PENDING"
        assert result["confidence"] == 0.60 and result["human_review_required"]
        assert result["trace"][:len(second["trace"])] == second["trace"]
        duplicates = [json.loads(entry["outcome"]) for entry in result["trace"] if entry["step"] == "duplicate_evidence"]
        assert duplicates == [{"kind": kind, "sha256": hashlib.sha256(DUPLICATE).hexdigest()}]
        assert upload(client, second, contents).status_code == 409
        assert client.get("/v1/verifications/" + result["id"]).json() == result
        assert any(item["id"] == result["id"] for item in client.get("/v1/review-queue").json())

    with TestClient(create_app(database)) as client:
        url = "/v1/verifications/" + result["id"]
        current = client.post(url + "/recheck", json={"chain_hash": result["chain_hash"]}).raise_for_status().json()
        assert current["status"] == "PENDING" and current["confidence"] == 0.60
        assert client.get("/v1/audit/" + result["id"]).json()["valid"]
        assert client.post(url + "/review", json={"chain_hash": current["chain_hash"], "decision": "approve", "note": "Synthetic unresolved duplicate"}).status_code == 409

        def unavailable(reference):
            raise registry.RegistryUnavailable

        monkeypatch.setattr(registry, "tool_registry_lookup", unavailable)
        outage = client.post(url + "/recheck", json={"chain_hash": current["chain_hash"]}).raise_for_status().json()
        assert outage["status"] == "UNKNOWN" and outage["human_review_required"]


def test_repeated_hash_within_same_verification_and_new_unique_files_are_not_duplicates(tmp_path):
    with TestClient(create_app(tmp_path / "unique.sqlite3")) as client:
        initial = client.post("/v1/verifications", json=registry.demo_listings()["L2"]).json()
        contents = {"label": DUPLICATE, "certificate": DUPLICATE}
        first = upload(client, initial, contents).raise_for_status().json()
        repeated = upload(client, first, contents).raise_for_status().json()
        other = client.post("/v1/verifications", json=registry.demo_listings()["L2"]).json()
        unique = upload(client, other, {"label": b"Unique label", "certificate": b"Unique certificate"}).raise_for_status().json()
        for result in (first, repeated, unique):
            assert result["status"] == "APPROVED"
            assert not any(entry["step"] == "duplicate_evidence" for entry in result["trace"])
