import pytest
from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app import registry


@pytest.mark.parametrize('case,status', [('L1','PENDING'),('L2','APPROVED'),('L3','DENIED'),('L4','DENIED'),('L5','UNKNOWN'),('L6','APPROVED'),('L7','PENDING')])
def test_live_scenarios(tmp_path, case, status):
    with TestClient(create_app(tmp_path / 'db.sqlite3')) as client:
        result = client.post('/v1/verifications', json=registry.demo_listings()[case]).json()
        assert result['status'] == status
        assert {rule['rule'] for rule in result['rule_results']} == {'R-01','R-02','R-03','R-04','R-05'}
        if case == 'L1':
            assert {rule['rule'] for rule in result['rule_results'] if rule['result'] == 'fail'} >= {'R-01','R-03'}


def test_outage_is_per_submission(tmp_path):
    with TestClient(create_app(tmp_path / 'db.sqlite3')) as client:
        listing = registry.demo_listings()['L2']
        listing['simulate_registry_outage'] = True
        result = client.post('/v1/verifications', json=listing).json()
        assert result['status'] == 'UNKNOWN'
        assert result['reason'] == 'registry_unavailable'
        assert result['human_review_required']
        listing['simulate_registry_outage'] = False
        assert client.post('/v1/verifications', json=listing).json()['status'] == 'APPROVED'


def test_missing_required_term(tmp_path):
    with TestClient(create_app(tmp_path / 'db.sqlite3')) as client:
        listing = registry.demo_listings()['L2']
        listing['description'] = 'Plain listing'
        assert client.post('/v1/verifications', json=listing).json()['status'] == 'DENIED'
