from fastapi.testclient import TestClient
from backend.app.main import create_app
from scripts.repair_demo_products import repair_demo_products, matched_listing


def test_repair_updates_only_known_demos_and_retains_history(tmp_path):
    with TestClient(create_app(tmp_path / 'demo.sqlite3')) as client:
        good = matched_listing()
        assert good['product_name'] in good['title']
        assert good['license_holder'] in good['title']
        assert good['images'][0].startswith('data:image/png;base64,')
        old = client.post('/v1/products', json={**good, 'product_name': 'Vitamin C Supplement',
            'license_holder': 'LumaVale', 'title': 'ลูมาเวล วิตามินซี พร้อมรูปสินค้า', 'images': []}).json()
        other = client.post('/v1/products', json={**good, 'title': 'Unverified example',
            'description': 'guaranteed for everyone'}).json()
        assert repair_demo_products(client) == [old['id']]
        saved = client.get('/v1/products/' + old['id']).json()
        assert saved['version'] == 2
        assert saved['listing']['title'] == good['title']
        assert saved['listing']['images'] == good['images']
        assert saved['verification']['status'] == 'APPROVED'
        assert saved['verification']['listing'] == saved['listing']
        assert client.get('/v1/verifications/' + old['verification']['id']).json() == old['verification']
        assert client.get('/v1/products/' + other['id']).json() == other
        assert repair_demo_products(client) == []
