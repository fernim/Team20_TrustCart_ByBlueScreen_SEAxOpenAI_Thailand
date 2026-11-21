import base64
from decimal import Decimal
from io import BytesIO
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.main import create_app

BASE=dict(registration_reference='DEMO-001',product_name='Vitamin C Supplement',license_holder='LumaVale',category='supplement',title='LumaVale Vitamin C',description='Vitamin C tablets.')

buffer = BytesIO()
Image.new('RGB', (2, 2), 'orange').save(buffer, format='PNG')
PNG = 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')

def test_product_media_price_stock_survive_edit_and_restart(tmp_path):
    db=tmp_path/'media.sqlite3'
    with TestClient(create_app(db)) as client:
        created=client.post('/v1/products',json={**BASE,'images':[PNG],'price':'199.50','stock':12})
        assert created.status_code==201
        first=created.json()
        assert first['listing']['images']==[PNG]
        assert Decimal(first['listing']['price'])==Decimal('199.50')
        assert first['listing']['stock']==12
        changed=client.put('/v1/products/'+first['id'],json={**BASE,'expected_version':1,'images':[],'price':'149.00','stock':0}).json()
        assert changed['version']==2
        assert changed['verification']['listing']['stock']==0
        assert any(e['step']=='listing_snapshot' for e in changed['verification']['trace'])
        assert client.get('/v1/verifications/'+first['verification']['id']).json()['listing']['images']==[PNG]
    with TestClient(create_app(db)) as client:
        latest=client.get('/v1/products/'+first['id']).json()['listing']
        assert latest['images']==[] and latest['stock']==0
        assert Decimal(latest['price'])==Decimal('149.00')

INVALID_COMMERCE_FIELDS = [
 {'price':'-1'}, {'price':'12.345'}, {'price':'NaN'}, {'stock':-1}, {'stock':1.5},
 {'images':['javascript:alert(1)']}, {'images':['https://example.com/image.png']},
 {'images':['data:image/svg+xml;base64,PHN2Zy8+']}, {'images':['data:image/png;base64,bm90LWFuLWltYWdl']},
 {'images':[PNG]*6}, {'images':[PNG.replace('image/png', 'image/jpeg')]},
 {'price':'100000000.00'}, {'stock':10000001},
 {'images':['data:image/png;base64,' + base64.b64encode(b'x' * (2 * 1024 * 1024 + 1)).decode('ascii')]},
]

@pytest.mark.parametrize('extra', INVALID_COMMERCE_FIELDS)
def test_invalid_product_commerce_fields_are_rejected(tmp_path,extra):
    with TestClient(create_app(tmp_path/'invalid.sqlite3')) as client:
        assert client.post('/v1/products',json={**BASE,'price':'199.00',**extra}).status_code==422
        assert client.get('/v1/products').json()==[]


@pytest.mark.parametrize('extra', INVALID_COMMERCE_FIELDS)
def test_invalid_commerce_edit_preserves_product_and_verification_history(tmp_path, extra):
    db = tmp_path / 'invalid-edit.sqlite3'
    with TestClient(create_app(db)) as client:
        created = client.post('/v1/products', json={
            **BASE, 'images': [PNG], 'price': '199.50', 'stock': 12,
        })
        assert created.status_code == 201
        original = created.json()
        product_url = '/v1/products/' + original['id']
        report_url = '/v1/verifications/' + original['verification']['id']

        rejected = client.put(product_url, json={
            **original['listing'], 'expected_version': original['version'], **extra,
        })
        assert rejected.status_code == 422
        assert client.get(product_url).json() == original
        assert client.get(report_url).json() == original['verification']
        assert client.get('/v1/products').json() == [original]

        # Rejected input must not consume a version or invalidate the saved hash.
        edited = client.put(product_url, json={
            **original['listing'], 'expected_version': original['version'], 'stock': 0,
        })
        assert edited.status_code == 200
        assert edited.json()['version'] == 2
        assert edited.json()['listing']['stock'] == 0
        assert client.get(report_url).json() == original['verification']

@pytest.mark.parametrize('extra', [{}, {'price': None}])
def test_saved_products_require_price_on_create_and_edit(tmp_path, extra):
    with TestClient(create_app(tmp_path/'required-price.sqlite3')) as client:
        assert client.post('/v1/products', json={**BASE, **extra}).status_code == 422
        original = client.post('/v1/products', json={**BASE, 'price':'199.00'}).json()
        rejected = client.put('/v1/products/'+original['id'], json={**BASE, 'expected_version':1, **extra})
        assert rejected.status_code == 422
        assert client.get('/v1/products/'+original['id']).json() == original
