import base64
from pathlib import Path

from fastapi.testclient import TestClient
from backend.app.main import create_app
from scripts.repair_demo_products import repair_demo_products, matched_listing


def test_real_product_names_match_exact_photo_variants():
    for capsules in (40, 120):
        listing = matched_listing(capsules)
        assert listing['product_name'] == f'DHC Vitamin C {capsules} capsules'
        assert str(capsules) in listing['title'] and str(capsules) in listing['description']
        assert listing['registration_reference'] != 'DEMO-001'
        assert listing['license_holder'] != 'Demo Brand'
        image = Path(__file__).resolve().parents[1] / f'frontend/assets/product-dhc-{capsules}.jpg'
        assert base64.b64decode(listing['images'][0].split(',')[1]) == image.read_bytes()


def test_repair_updates_only_known_demos_and_retains_history(tmp_path):
    with TestClient(create_app(tmp_path / 'demo.sqlite3')) as client:
        legacy = dict(registration_reference='DEMO-001', product_name='Vitamin C Supplement',
            license_holder='LumaVale', category='supplement', title='ลูมาเวล วิตามินซี พร้อมรูปสินค้า',
            description='ผลิตภัณฑ์เสริมอาหาร', price='249.50', stock=7, images=[])
        old = client.post('/v1/products', json=legacy).json()
        illustration = Path(__file__).resolve().parents[1] / 'frontend/assets/demo-supplement.png'
        prior = client.post('/v1/products', json={**legacy, 'product_name':'Demo Supplement',
            'license_holder':'Demo Brand', 'title':'Demo Supplement — Demo Brand',
            'images':['data:image/png;base64,' + base64.b64encode(illustration.read_bytes()).decode()]}).json()
        other = client.post('/v1/products', json={**legacy, 'title':'Unverified example'}).json()
        assert set(repair_demo_products(client)) == {old['id'], prior['id']}
        for original in (old, prior):
            saved = client.get('/v1/products/' + original['id']).json()
            assert saved['version'] == 2
            assert saved['listing']['product_name'].startswith('DHC Vitamin C')
            assert saved['listing']['price'] == '249.50' and saved['listing']['stock'] == 7
            assert saved['verification']['status'] == 'UNKNOWN'
            assert saved['verification']['human_review_required']
            assert saved['verification']['listing'] == saved['listing']
            assert client.get('/v1/verifications/' + original['verification']['id']).json() == original['verification']
        assert client.get('/v1/products/' + other['id']).json() == other
        assert repair_demo_products(client) == []
