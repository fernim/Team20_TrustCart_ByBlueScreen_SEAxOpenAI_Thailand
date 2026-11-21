import json
import sqlite3
from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app.registry import demo_listings


def test_legacy_database_read_and_safe_mutation_error(tmp_path):
    database = tmp_path / "db.sqlite3"
    with TestClient(create_app(database)) as client:
        result = client.post("/v1/verifications", json=demo_listings()["L1"]).json()
    with sqlite3.connect(database) as connection:
        connection.execute("ALTER TABLE verifications DROP COLUMN listing")
    with TestClient(create_app(database)) as client:
        assert client.get("/v1/verifications/" + result["id"]).status_code == 200
        response = client.post("/v1/verifications/" + result["id"] + "/recheck", json={"chain_hash": result["chain_hash"]})
        assert response.status_code == 409


def test_evidence_retry_is_stale_and_atomic(tmp_path):
    database = tmp_path / "db.sqlite3"
    with TestClient(create_app(database)) as client:
        listing = demo_listings()["L1"]
        result = client.post("/v1/verifications", json=listing).json()
        path = "/v1/verifications/" + result["id"]
        data = {"chain_hash":result["chain_hash"], "product_name":listing["product_name"],
            "license_holder":listing["license_holder"], "registration_reference":listing["registration_reference"]}
        files = {"label":("label.txt",b"synthetic"),"certificate":("certificate.txt",b"synthetic")}
        assert client.post(path + "/evidence",data=data,files=files).status_code == 200
        assert client.post(path + "/evidence",data=data,files=files).status_code == 409
        with sqlite3.connect(database) as connection:
            assert connection.execute("SELECT COUNT(*) FROM evidence").fetchone()[0] == 2
        report = client.get("/v1/reports/" + result["id"]).json()
        assert report["audit"]["valid"]
        assert result["trace"] == report["trace"][:len(result["trace"])]
