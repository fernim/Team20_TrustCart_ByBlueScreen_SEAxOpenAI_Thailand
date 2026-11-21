import pytest
import httpx
from test_connected_access import connected, login
from test_connected_workflow import setup_case
from test_connected_submit_review import configure_checks, submit
from backend.app import registry


@pytest.mark.parametrize('failed', [('documents',), ('claims',), ('documents', 'claims')])
def test_live_ai_failure_routes_to_manual_review_and_requires_explicit_replacements(connected, failed):
    client, password = connected
    product, result = setup_case(client, password)
    configure_checks(client, [])
    def unavailable(*args):
        raise httpx.ReadTimeout('private provider response')
    for check in failed:
        setattr(client.app.state, 'document_assessor' if check == 'documents' else 'claim_assessor', unavailable)
    response = submit(client, result)
    assert response.status_code == 200
    checked = response.json()
    assert checked['status'] == 'PENDING'
    assert checked['stage'] == 'REVIEWER_REQUIRED'
    assert checked['human_review_required']
    assert set(checked['manual_review_checks']) == set(failed)
    assert 'private provider response' not in response.text
    assert not client.get('/v1/catalog/products').json()[0]['badge_eligible']
    login(client, password, 'reviewer')
    started = client.post('/v1/reviewer/submissions/' + checked['id'] + '/start-review', json={'chain_hash': checked['chain_hash']}).json()
    endpoint = '/v1/reviewer/submissions/' + checked['id'] + '/decision'
    payload = dict(chain_hash=started['chain_hash'], decision='approve', note='Manually inspected original evidence and listing claims',
        confirmed_documents=[d['id'] for d in started['documents']],
        confirmed_fields={k: product['listing'][k] for k in ('product_name', 'license_holder', 'registration_reference')})
    assert client.post(endpoint, json=payload).status_code == 422
    assert client.post(endpoint, json={**payload, 'confirmed_manual_checks': list(failed), 'confirmed_documents': []}).status_code == 422
    assert client.post(endpoint, json={**payload, 'chain_hash': checked['chain_hash'], 'confirmed_manual_checks': list(failed)}).status_code == 409
    approved = client.post(endpoint, json={**payload, 'confirmed_manual_checks': list(failed)})
    assert approved.status_code == 200, approved.text
    approved = approved.json()
    assert approved['status'] == 'APPROVED'
    assert set(approved['manual_reviewed_checks']) == set(failed)
    for check in failed:
        assert approved['document_check' if check == 'documents' else 'claim_check']['state'] == 'unavailable'
    assert client.get('/v1/reviewer/submissions/' + checked['id']).json()['audit']['valid']
    assert client.get('/v1/catalog/products').json()[0]['badge_eligible']
    assert approved['trace'][-1]['step'] == 'human_review'


@pytest.mark.parametrize('blocker', ['registry', 'claim'])
def test_manual_ai_fallback_cannot_override_registry_outage_or_prohibited_claim(connected, monkeypatch, blocker):
    client, password = connected
    product, result = setup_case(client, password, 'overclaim' if blocker == 'claim' else 'clean')
    configure_checks(client, [])
    def unavailable(*args):
        raise httpx.ReadTimeout('offline')
    client.app.state.claim_assessor = unavailable
    if blocker == 'registry':
        def registry_outage(reference):
            raise registry.RegistryUnavailable
        monkeypatch.setattr(registry, 'tool_registry_lookup', registry_outage)
    checked = submit(client, result).json()
    assert checked['status'] == ('UNKNOWN' if blocker == 'registry' else 'DENIED')
    login(client, password, 'reviewer')
    response = client.post('/v1/reviewer/submissions/' + checked['id'] + '/decision', json={
        'chain_hash': checked['chain_hash'], 'decision': 'approve', 'note': 'Attempt to override a required rule',
        'confirmed_manual_checks': ['claims'], 'confirmed_documents': [d['id'] for d in checked['documents']],
        'confirmed_fields': {k: product['listing'][k] for k in ('product_name', 'license_holder', 'registration_reference')}})
    assert response.status_code == 409
    assert not client.get('/v1/catalog/products').json()[0]['badge_eligible']
