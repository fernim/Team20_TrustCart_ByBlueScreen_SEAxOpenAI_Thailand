import json
import sqlite3

import pytest


@pytest.fixture(autouse=True)
def isolate_external_configuration(monkeypatch):
    """Keep API tests independent of the developer's live configuration."""
    monkeypatch.delenv("TRUSTCART_DATABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("TRUSTCART_REVIEWER_PASSWORD", raising=False)
    monkeypatch.delenv("TRUSTCART_AI_TRANSFER_APPROVED", raising=False)
    monkeypatch.delenv("TRUSTCART_MARKETPLACE_CLIENTS", raising=False)


@pytest.fixture(autouse=True)
def isolate_legacy_policy_auth(request, monkeypatch):
    """Legacy rule/API tests isolate their policy subject; connected tests exercise real sessions.

    No application environment flag disables authorization. Only this test harness replaces
    the guard for pre-existing policy tests, whose direct API contracts are diagnostic-only.
    """
    if request.node.path.name.startswith('test_connected'):
        return
    from backend.app import security
    async def policy_guard(request, call_next):
        return await call_next(request)
    monkeypatch.setattr(security, 'access_guard', policy_guard)


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
