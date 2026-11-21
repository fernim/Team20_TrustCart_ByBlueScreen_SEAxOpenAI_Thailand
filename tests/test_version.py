import pytest
from fastapi.testclient import TestClient

from app import create_demo_app


@pytest.mark.parametrize("commit", [None, "a" * 40])
@pytest.mark.parametrize("configured_password", [False, True])
def test_version_is_public_and_returns_only_commit(tmp_path, monkeypatch, commit, configured_password):
    monkeypatch.delenv("VERCEL_GIT_COMMIT_SHA", raising=False)
    monkeypatch.delenv("TRUSTCART_DEMO_PASSWORD", raising=False)
    if commit:
        monkeypatch.setenv("VERCEL_GIT_COMMIT_SHA", commit)
    if configured_password:
        monkeypatch.setenv("TRUSTCART_DEMO_PASSWORD", "test-only")
    with TestClient(create_demo_app(tmp_path / "version.sqlite3")) as client:
        response = client.get("/version")
        assert response.status_code == 200
        assert response.json() == {"commit": commit or "local"}
        blocked = 401 if configured_password else 503
        assert client.get("/").status_code == 200
        for route in ("/docs", "/openapi.json", "/v1/products", "/version/private"):
            assert client.get(route).status_code == blocked
        assert client.post("/version").status_code == blocked
        if configured_password:
            schema = client.get("/openapi.json", auth=("demo", "test-only")).json()
            assert schema["paths"]["/version"]["get"]["security"] == []
