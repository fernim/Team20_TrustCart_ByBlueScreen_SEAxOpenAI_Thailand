import json
import sqlite3

import pytest


@pytest.fixture(autouse=True)
def isolate_external_configuration(monkeypatch):
    """Unit and local API tests must never use a developer's live database or AI client."""
    monkeypatch.delenv("TRUSTCART_DATABASE_URL", raising=False)
    monkeypatch.delenv("TRUSTCART_AI_TRANSFER_APPROVED", raising=False)


@pytest.fixture
def corrupt_saved_audit():
    def corrupt(database, verification_id):
        with sqlite3.connect(database) as connection:
            row = connection.execute(
                "SELECT result FROM verifications WHERE id = ?", (verification_id,)
            ).fetchone()
            result = json.loads(row[0])
            result["trace"][0]["outcome"] = "Changed audit test fixture"
            connection.execute(
                "UPDATE verifications SET result = ? WHERE id = ?",
                (json.dumps(result), verification_id),
            )

    return corrupt
