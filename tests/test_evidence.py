import hashlib
import json
import sqlite3
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app import registry
from backend.app.main import create_app
from backend.app.registry import demo_listings


def test_evidence_upload_records_hashes_and_routes_conflict_to_review(tmp_path):
    database = tmp_path / "demo.sqlite3"
    listing = demo_listings()["L1"]
    files = {
        "label": ("label.txt", b"synthetic label"),
        "certificate": ("certificate.txt", b"synthetic certificate"),
    }
    with TestClient(create_app(database)) as client:
        initial = client.post("/v1/verifications", json=listing).json()
        url = f"/v1/verifications/{initial['id']}"
        fields = {
            "registration_reference": listing["registration_reference"],
            "product_name": listing["product_name"],
            "license_holder": listing["license_holder"],
            "chain_hash": initial["chain_hash"],
        }
        assert client.post(f"/v1/verifications/{uuid4()}/evidence", data=fields, files=files).status_code == 404
        response = client.post(f"{url}/evidence", data=fields, files=files)
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "PENDING"
        assert result["reason"] == "evidence_conflict"
        assert result["confidence"] == 0.60
        assert result["human_review_required"] is True
        assert next(rule for rule in result["rule_results"] if rule["rule"] == "R-05")["result"] == "fail"
        assert result["trace"][:len(initial["trace"])] == initial["trace"]
        assert [json.loads(entry["outcome"]) for entry in result["trace"] if entry["step"] == "evidence"] == [
            {"kind": kind, "sha256": hashlib.sha256(content).hexdigest(), "chain_hash": initial["chain_hash"]}
            for kind, (_, content) in files.items()
        ]
        previous_hash = initial["chain_hash"]
        for entry in result["trace"][len(initial["trace"]):]:
            event = {key: value for key, value in entry.items() if key != "chain_hash"}
            assert event["previous_hash"] == previous_hash
            previous_hash = hashlib.sha256(json.dumps(event, sort_keys=True).encode("utf-8")).hexdigest()
            assert entry["chain_hash"] == previous_hash
        assert result["chain_hash"] == previous_hash
        assert client.post(f"{url}/evidence", data=fields, files=files).status_code == 409

    with TestClient(create_app(database)) as client:
        assert client.get(url).json() == result


def test_recheck_reuses_persisted_evidence_and_appends_to_trace(tmp_path, monkeypatch):
    database = tmp_path / "demo.sqlite3"
    listing = demo_listings()["L1"]
    with TestClient(create_app(database)) as client:
        initial = client.post("/v1/verifications", json=listing).json()
        url = f"/v1/verifications/{initial['id']}"
        upload = client.post(
            f"{url}/evidence",
            data={
                "registration_reference": listing["registration_reference"],
                "product_name": listing["product_name"],
                "license_holder": listing["license_holder"],
                "chain_hash": initial["chain_hash"],
            },
            files={"label": ("label.txt", b"label"), "certificate": ("certificate.txt", b"certificate")},
        )
        assert upload.status_code == 200
        current = upload.json()

    with TestClient(create_app(database)) as client:
        response = client.post(f"{url}/recheck", json={"chain_hash": current["chain_hash"]})
        assert response.status_code == 200
        rechecked = response.json()
        assert rechecked["id"] == initial["id"]
        assert rechecked["status"] == "PENDING"
        assert rechecked["reason"] == "evidence_conflict"
        assert {rule["rule"] for rule in rechecked["rule_results"] if rule["result"] == "fail"} >= {"R-03", "R-05"}
        assert rechecked["trace"][:len(current["trace"])] == current["trace"]
        previous_hash = current["chain_hash"]
        for entry in rechecked["trace"][len(current["trace"]):]:
            event = {key: value for key, value in entry.items() if key != "chain_hash"}
            assert event["previous_hash"] == previous_hash
            previous_hash = hashlib.sha256(json.dumps(event, sort_keys=True).encode("utf-8")).hexdigest()
            assert entry["chain_hash"] == previous_hash
        assert rechecked["chain_hash"] == previous_hash != current["chain_hash"]
        assert client.get(url).json() == rechecked
        assert client.post(f"{url}/recheck", json={"chain_hash": current["chain_hash"]}).status_code == 409

        def registry_unavailable(reference):
            raise registry.RegistryUnavailable

        monkeypatch.setattr(registry, "tool_registry_lookup", registry_unavailable)
        outage = client.post(f"{url}/recheck", json={"chain_hash": rechecked["chain_hash"]}).json()
        assert outage["status"] == "UNKNOWN"
        assert outage["human_review_required"] is True
        assert next(rule for rule in outage["rule_results"] if rule["rule"] == "R-05")["result"] == "skip"


def test_recheck_migrates_feature_branch_evidence_store(tmp_path):
    database = tmp_path / "previous-feature.sqlite3"
    listing = demo_listings()["L1"]
    with TestClient(create_app(tmp_path / "fixture.sqlite3")) as client:
        initial = client.post("/v1/verifications", json=listing).raise_for_status().json()
    declaration = {key: listing[key] for key in ("registration_reference", "product_name", "license_holder")}
    label_hash = hashlib.sha256(b"legacy label").hexdigest()
    certificate_hash = hashlib.sha256(b"legacy certificate").hexdigest()
    with sqlite3.connect(database) as connection:
        connection.executescript("""
            CREATE TABLE verifications (id TEXT PRIMARY KEY, result TEXT NOT NULL);
            CREATE TABLE verification_listings (
                verification_id TEXT PRIMARY KEY REFERENCES verifications(id), listing TEXT NOT NULL
            );
            CREATE TABLE evidence (
                id INTEGER PRIMARY KEY, verification_id TEXT NOT NULL REFERENCES verifications(id),
                identity TEXT NOT NULL, label_sha256 TEXT NOT NULL, certificate_sha256 TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """)
        connection.execute("INSERT INTO verifications VALUES (?, ?)", (initial["id"], json.dumps(initial)))
        connection.execute("INSERT INTO verification_listings VALUES (?, ?)", (initial["id"], json.dumps(listing)))
        connection.execute(
            "INSERT INTO evidence VALUES (1, ?, ?, ?, ?, ?)",
            (initial["id"], json.dumps(declaration), label_hash, certificate_hash, initial["trace"][-1]["at"]),
        )

    with TestClient(create_app(database)) as client:
        assert client.get(f"/v1/verifications/{initial['id']}").json() == initial
        report_url = f"/v1/reports/{initial['id']}"
        report = client.get(report_url).raise_for_status().json()
        assert report["listing"] == listing
        assert {(item["kind"], item["sha256"]) for item in report["evidence"]} == {
            ("label", label_hash), ("certificate", certificate_hash),
        }
        response = client.post(
            f"/v1/verifications/{initial['id']}/recheck", json={"chain_hash": initial["chain_hash"]}
        )
        result = response.raise_for_status().json()
        assert result["reason"] == "evidence_conflict"
        assert result["trace"][:len(initial["trace"])] == initial["trace"]
        assert client.get(report_url).json()["audit"]["valid"]

    with TestClient(create_app(database)) as client:
        assert len(client.get(report_url).json()["evidence"]) == 2


def test_permit_and_evidence_use_the_same_registry_record(tmp_path, monkeypatch):
    listing = demo_listings()["L7"]
    with TestClient(create_app(tmp_path / "demo.sqlite3")) as client:
        initial = client.post("/v1/verifications", json=listing).raise_for_status().json()
        record = registry.tool_registry_lookup(listing["registration_reference"])
        seen = []

        def lookup(reference):
            seen.append(reference)
            if len(seen) > 1:
                raise registry.RegistryUnavailable
            return record

        monkeypatch.setattr(registry, "tool_registry_lookup", lookup)
        response = client.post(
            f"/v1/verifications/{initial['id']}/evidence",
            data={
                "registration_reference": listing["registration_reference"],
                "product_name": listing["product_name"],
                "license_holder": listing["license_holder"],
                "chain_hash": initial["chain_hash"],
            },
            files={"label": ("label.txt", b"label"), "certificate": ("certificate.txt", b"certificate")},
        )
        result = response.raise_for_status().json()
        assert seen == [listing["registration_reference"]]
        assert result["status"] == "PENDING"
        assert result["reason"] == "permit_conflict"
        rules = {rule["rule"]: rule["result"] for rule in result["rule_results"]}
        assert {rule: rules[rule] for rule in ("R-04", "R-05")} == {"R-04": "fail", "R-05": "pass"}
        assert sum(entry["step"] == "R-05" for entry in result["trace"]) == 2


def test_recheck_does_not_repeat_a_previous_request_outage(tmp_path):
    listing = {**demo_listings()["L7"], "simulate_registry_outage": True}
    with TestClient(create_app(tmp_path / "demo.sqlite3")) as client:
        initial = client.post("/v1/verifications", json=listing).raise_for_status().json()
        assert initial["status"] == "UNKNOWN"
        permit = next(rule for rule in initial["rule_results"] if rule["rule"] == "R-04")
        assert permit["result"] == "skip"
        result = client.post(
            f"/v1/verifications/{initial['id']}/recheck", json={"chain_hash": initial["chain_hash"]}
        ).raise_for_status().json()
        assert result["status"] == "PENDING"
        assert result["reason"] == "permit_conflict"


def test_legacy_permit_conflict_needs_a_new_listing(tmp_path):
    database = tmp_path / "demo.sqlite3"
    listing = demo_listings()["L7"]
    with TestClient(create_app(database)) as client:
        initial = client.post("/v1/verifications", json=listing).raise_for_status().json()
        assert initial["status"] == "PENDING"
        listing.pop("advertising_permit")
        listing["advertising_permit_conflict"] = True
        with sqlite3.connect(database) as connection:
            connection.execute(
                "UPDATE verifications SET listing=? WHERE id=?", (json.dumps(listing), initial["id"]),
            )
        url = f"/v1/verifications/{initial['id']}"
        recheck = client.post(f"{url}/recheck", json={"chain_hash": initial["chain_hash"]})
        assert recheck.status_code == 409
        assert client.get(url).json() == initial


def test_blank_evidence_declarations_leave_verification_unchanged(tmp_path):
    listing = demo_listings()["L1"]
    with TestClient(create_app(tmp_path / "demo.sqlite3")) as client:
        initial = client.post("/v1/verifications", json=listing).raise_for_status().json()
        fields = {
            "registration_reference": listing["registration_reference"],
            "product_name": listing["product_name"],
            "license_holder": listing["license_holder"],
            "chain_hash": initial["chain_hash"],
        }
        url = f"/v1/verifications/{initial['id']}"
        for field in ("registration_reference", "product_name", "license_holder"):
            response = client.post(
                f"{url}/evidence",
                data={**fields, field: " \t "},
                files={"label": ("label.txt", b"label"), "certificate": ("certificate.txt", b"certificate")},
            )
            assert response.status_code == 422

        assert client.get(url).json() == initial
        report = client.get(f"/v1/reports/{initial['id']}").raise_for_status().json()
        assert report["evidence"] == []
