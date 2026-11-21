import pytest


@pytest.fixture(autouse=True)
def isolate_external_configuration(monkeypatch):
    """Unit and local API tests must never use a developer's live database or AI client."""
    monkeypatch.delenv("TRUSTCART_DATABASE_URL", raising=False)
    monkeypatch.delenv("TRUSTCART_AI_TRANSFER_APPROVED", raising=False)
