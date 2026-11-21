import pytest


@pytest.fixture(autouse=True)
def isolate_external_configuration(monkeypatch):
    """Unit and local API tests must never use a developer's live database or AI client."""
    monkeypatch.delenv("TRUSTCART_DATABASE_URL", raising=False)
    monkeypatch.delenv("TRUSTCART_AI_TRANSFER_APPROVED", raising=False)


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
