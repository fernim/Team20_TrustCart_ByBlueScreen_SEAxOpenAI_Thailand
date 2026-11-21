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


def test_reviewer_has_its_own_page_and_can_retrieve_a_stored_report(tmp_path):
    with TestClient(create_app(tmp_path / 'review.sqlite3')) as client:
        reviewer = client.get('/reviewer')
        assert reviewer.status_code == 200
        assert 'id="report-lookup"' in reviewer.text
        assert 'reviewer.js' in reviewer.text
        customer = client.get('/').text
        assert 'id="verification-dialog"' not in customer
        submission = client.post('/v1/verifications', json={
            'registration_reference':'DEMO-001', 'product_name':'Vitamin C Supplement',
            'license_holder':'LumaVale', 'category':'supplement',
        })
        assert submission.json()['status'] == 'APPROVED'
        stored = client.get(submission.headers['location']).json()
        assert stored['trace']
        assert stored['chain_hash'] == submission.json()['chain_hash']


def test_seller_page_and_listing_snapshot_roundtrip(tmp_path):
    payload = {'registration_reference':'DEMO-001','product_name':'Vitamin C Supplement','license_holder':'LumaVale','category':'supplement','title':'LumaVale Vitamin C','description':'Synthetic listing.'}
    with TestClient(create_app(tmp_path/'seller.sqlite3')) as client:
        assert client.get('/seller').status_code == 200
        result = client.post('/v1/verifications',json=payload)
        assert result.json()['listing'] == {**payload, 'images': [], 'price': None, 'stock': None}
        assert client.get(result.headers['location']).json()['listing'] == {**payload, 'images': [], 'price': None, 'stock': None}


def test_product_detail_urls_serve_the_storefront_shell(tmp_path):
    with TestClient(create_app(tmp_path / 'detail-pages.sqlite3')) as client:
        for product_id in ['0', '8cba5000-67d7-4f61-89da-758d09137964']:
            response = client.get('/products/' + product_id)
            assert response.status_code == 200
            assert 'id="product-page"' in response.text
            assert '<dialog id="product-dialog"' not in response.text
