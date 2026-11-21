import json
from contextlib import closing
from test_connected_access import connected, login
from test_connected_workflow import setup_case, run
from backend.app import database as store
from backend.app.connected_store import initialize


def test_marketplace_persists_and_cannot_be_changed_by_seller(connected):
    client, password = connected
    product, submission = setup_case(client, password)
    assert product['marketplace'] == 'shopee'
    edited = client.put('/v1/seller/products/' + product['id'], json={**product['listing'], 'expected_version': 1, 'marketplace': 'lazada'}).json()
    assert edited['marketplace'] == 'shopee'
    with closing(store.connect(client.app.state.database)) as connection:
        saved = json.loads(connection.execute('SELECT result FROM products WHERE id=?', (product['id'],)).fetchone()[0])
        assert saved['marketplace'] == 'shopee'


def test_agency_queue_filters_and_counts_reconcile_current_submissions(connected):
    client, password = connected
    _, pending = setup_case(client, password, 'uncertain')
    pending = run(client, pending)
    _, completed = setup_case(client, password)
    completed = run(client, completed)
    login(client, password, 'reviewer')
    response = client.get('/v1/reviewer/queue?marketplace=shopee&work_queue=to_review')
    assert response.status_code == 200, response.text
    data = response.json()
    assert [r['id'] for r in data['items']] == [pending['id']]
    assert data['counts']['all'] == 2 and data['counts']['completed'] == 1
    assert data['counts']['to_review'] == 1
    assert all(row['marketplace'] == 'shopee' for row in data['items'])
    assert data['items'][0]['updated_at']
    assert client.get('/v1/reviewer/queue?marketplace=lazada').json()['counts']['all'] == 0
    filtered = client.get('/v1/reviewer/queue', params={'status': 'APPROVED', 'q': completed['listing_title']}).json()
    assert filtered['counts']['all'] == 1
    assert [r['id'] for r in filtered['items']] == [completed['id']]
    assert client.get('/v1/reviewer/queue?marketplace=other').status_code == 422
    assert client.get('/v1/reviewer/queue?work_queue=other').status_code == 422


def test_agency_queue_excludes_superseded_and_is_protected(connected):
    client, password = connected
    assert client.get('/v1/reviewer/queue').status_code == 401
    product, submission = setup_case(client, password)
    assert client.get('/v1/reviewer/queue').status_code == 403
    client.put('/v1/seller/products/' + product['id'], json={**product['listing'], 'expected_version': 1, 'title': 'New revision'})
    login(client, password, 'reviewer')
    assert client.get('/v1/reviewer/queue').json()['items'] == []


def test_marketplace_backfill_is_additive_and_idempotent(connected):
    client, password = connected
    product, _ = setup_case(client, password)
    with closing(store.connect(client.app.state.database)) as connection, connection:
        raw = json.loads(connection.execute('SELECT result FROM products WHERE id=?', (product['id'],)).fetchone()[0])
        raw.pop('marketplace', None)
        connection.execute('UPDATE products SET result=? WHERE id=?', (json.dumps(raw), product['id']))
        initialize(connection)
        initialize(connection)
        saved = json.loads(connection.execute('SELECT result FROM products WHERE id=?', (product['id'],)).fetchone()[0])
    assert saved == {**raw, 'marketplace': 'shopee'}
