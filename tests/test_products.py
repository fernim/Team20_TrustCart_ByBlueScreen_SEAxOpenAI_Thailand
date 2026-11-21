from fastapi.testclient import TestClient
from backend.app.main import create_app

PAYLOAD=dict(price="199.00",registration_reference='DEMO-001',product_name='Demo Supplement',license_holder='Demo Brand',category='supplement',title='Seller Vitamin C',description='\u0e1c\u0e25\u0e34\u0e15\u0e20\u0e31\u0e13\u0e11\u0e4c\u0e40\u0e2a\u0e23\u0e34\u0e21\u0e2d\u0e32\u0e2b\u0e32\u0e23')

def test_product_create_edit_latest_result_and_history_persist(tmp_path):
 db=tmp_path/'products.sqlite3'
 with TestClient(create_app(db)) as client:
  created=client.post('/v1/products',json=PAYLOAD)
  assert created.status_code==201
  first=created.json(); assert first['verification']['status']=='APPROVED'
  denied=client.put('/v1/products/'+first['id'],json={**PAYLOAD,'title':'ผิวกระจ่างใสทันที 100%','expected_version':1}).json()
  assert denied['id']==first['id'] and denied['version']==2
  assert denied['verification']['status']=='DENIED'
  assert len(client.get('/v1/products').json())==1
  stale=client.put('/v1/products/'+first['id'],json={**PAYLOAD,'expected_version':1})
  assert stale.status_code==409
  assert client.get('/v1/verifications/'+first['verification']['id']).json()['status']=='APPROVED'
 with TestClient(create_app(db)) as client:
  current=client.get('/v1/products').json()[0]
  assert current['verification']['status']=='DENIED'
  fixed=client.put('/v1/products/'+first['id'],json={**PAYLOAD,'expected_version':2}).json()
  assert fixed['version']==3 and fixed['verification']['status']=='APPROVED'
  assert client.get('/v1/products/'+first['id']).json()==fixed
  assert client.get('/v1/products').headers['cache-control']=='no-store'
