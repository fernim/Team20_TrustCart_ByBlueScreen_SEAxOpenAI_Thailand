import json
import sqlite3

import pytest


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
