import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_storefront_is_served_independent_of_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        page = client.get("/")
        assert page.status_code == 200
        assert "text/html" in page.headers["content-type"]
        assert 'lang="th"' in page.text
        assert "TrustCart" in page.text
        assert 'id="search-form"' in page.text
        assert client.get("/static/styles.css").status_code == 200
        assert client.get("/static/app.js").status_code == 200
        assert client.get("/static/../../AGENTS.md").status_code == 404
        assert client.get("/docs").status_code == 200


def test_reference_images_are_available_locally(tmp_path):
    assets = Path(__file__).resolve().parents[1] / "frontend" / "assets"
    manifest = json.loads((assets / "sources.json").read_text())
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        for asset in manifest["assets"]:
            response = client.get("/static/assets/" + asset["file"])
            assert response.status_code == 200
            assert response.headers["content-type"] == "image/webp"
            assert len(response.content) == asset["bytes"]
