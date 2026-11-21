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


def test_start_review_is_audited_preserves_result_and_rejects_stale_hash(connected):
    client, password = connected
    _, result = setup_case(client, password, 'uncertain')
    result = run(client, result)
    endpoint = '/v1/reviewer/submissions/' + result['id'] + '/start-review'
    assert client.post(endpoint, json={'chain_hash': result['chain_hash']}).status_code == 403
    login(client, password, 'reviewer')
    assert client.post(endpoint, json={'chain_hash': '0' * 64}).status_code == 409
    started = client.post(endpoint, json={'chain_hash': result['chain_hash']})
    assert started.status_code == 200, started.text
    started = started.json()
    assert started['stage'] == 'IN_REVIEW'
    for key in ('status', 'confidence', 'rule_results', 'human_review_required'):
        assert started[key] == result[key]
    assert started['trace'][:-1] == result['trace']
    assert started['trace'][-1]['step'] == 'review_started'
    assert started['chain_hash'] != result['chain_hash']
    assert client.post(endpoint, json={'chain_hash': result['chain_hash']}).status_code == 409
    assert client.get('/v1/reviewer/queue?work_queue=in_progress').json()['counts']['in_progress'] == 1
    response = client.post('/v1/reviewer/submissions/' + result['id'] + '/decision', json={'chain_hash': started['chain_hash'], 'decision': 'request_documents', 'note': 'Provide clearer original documents'})
    assert response.status_code == 200, response.text
    assert response.json()['stage'] == 'SELLER_ACTION'


def test_start_review_never_turns_unavailability_into_approval(connected):
    client, password = connected
    _, result = setup_case(client, password)
    result = run(client, result, 'live')
    assert result['status'] == 'UNKNOWN'
    login(client, password, 'reviewer')
    started = client.post('/v1/reviewer/submissions/' + result['id'] + '/start-review', json={'chain_hash': result['chain_hash']})
    assert started.status_code == 200
    assert started.json()['status'] == 'UNKNOWN'
    assert started.json()['confidence'] < 0.75
    assert not client.get('/v1/catalog/products').json()[0]['badge_eligible']


def test_start_review_rejects_waiting_completed_and_superseded(connected):
    client, password = connected
    _, waiting = setup_case(client, password)
    login(client, password, 'reviewer')
    assert client.post('/v1/reviewer/submissions/' + waiting['id'] + '/start-review', json={'chain_hash': waiting['chain_hash']}).status_code == 409
    product, result = setup_case(client, password)
    completed = run(client, result)
    login(client, password, 'reviewer')
    assert client.post('/v1/reviewer/submissions/' + completed['id'] + '/start-review', json={'chain_hash': completed['chain_hash']}).status_code == 409
    product, result = setup_case(client, password, 'uncertain')
    result = run(client, result)
    client.put('/v1/seller/products/' + product['id'], json={**product['listing'], 'expected_version': 1})
    login(client, password, 'reviewer')
    assert client.post('/v1/reviewer/submissions/' + result['id'] + '/start-review', json={'chain_hash': result['chain_hash']}).status_code == 409


def test_agency_dashboard_is_role_protected_in_both_entrypoints(connected, tmp_path, monkeypatch):
    from app import create_demo_app
    from fastapi.testclient import TestClient
    client, password = connected
    assert client.get('/agency', follow_redirects=False).status_code == 303
    login(client, password, 'buyer')
    assert client.get('/agency').status_code == 403
    login(client, password, 'reviewer')
    response = client.get('/agency')
    assert response.status_code == 200 and 'agency.js' in response.text
    monkeypatch.setenv('TRUSTCART_REVIEWER_PASSWORD', password)
    with TestClient(create_demo_app(tmp_path / 'agency-hosted.sqlite3')) as hosted:
        assert hosted.get('/agency', follow_redirects=False).status_code == 303
        login(hosted, password, 'reviewer')
        assert hosted.get('/agency').status_code == 200
