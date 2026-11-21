import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app import registry

BASE = dict(registration_reference='DEMO-001', product_name='Vitamin C Supplement', license_holder='LumaVale Demo', category='supplement')

@pytest.mark.parametrize('title,description,expected_code', [
    ('ออราเฟิร์น คอลลาเจน — ผิวดูอ่อนวัยใน 3 วัน', 'เห็นผลแน่นอนทุกคน', 'rapid_appearance_change'),
    ('โนวาลีฟ วิตามินซี — ผิวกระจ่างใสทันที 100%', 'ผิวกระจ่างใสทันที 100% ตั้งแต่ครั้งแรก', 'instant_effect'),
    ('ซันพีค น้ำมันปลา — ความจำดีขึ้นทันทีทุกคน', 'เห็นผลทุกคนโดยไม่มีข้อยกเว้น', 'instant_effect'),
    ('AuraFern Collagen — younger-looking skin in 3 days', 'Guaranteed for everyone.', 'rapid_appearance_change'),
    ('NovaLeaf Vitamin C — instantly brighter skin, 100% guaranteed', '', 'instant_effect'),
    ('SunPeak Fish Oil — instantly better memory for everyone', '', 'instant_effect'),
])
def test_r03_denies_literal_overclaims_and_persists_evidence(tmp_path, title, description, expected_code):
    with TestClient(create_app(tmp_path / 'claims.sqlite3')) as client:
        response = client.post('/v1/verifications', json={**BASE, 'title':title, 'description':description})
        assert response.status_code == 201
        result = response.json()
        assert result['status'] == 'DENIED'
        assert result['reason'] == 'advertising_overclaim'
        assert expected_code in [item['code'] for item in result['claim_findings']]
        for finding in result['claim_findings']:
            assert finding['phrase'] in {'title': title, 'description': description}[finding['source']]
            assert finding['rule_id'] == 'R-03'
            assert finding['reason_th'] and finding['reason_en']
        assert any(item['step']=='R-03' and expected_code in item['outcome'] for item in result['trace'])
        previous = None
        for entry in result['trace']:
            event = {key:value for key,value in entry.items() if key!='chain_hash'}
            assert entry['previous_hash'] == previous
            previous = hashlib.sha256(json.dumps(event, sort_keys=True).encode('utf-8')).hexdigest()
            assert entry['chain_hash'] == previous
        assert client.get(response.headers['location']).json() == result


def test_corrected_copy_reruns_rule_and_passes_without_invented_findings(tmp_path):
    with TestClient(create_app(tmp_path / 'claims.sqlite3')) as client:
        denied=client.post('/v1/verifications',json={**BASE,'description':'เห็นผลแน่นอนทุกคน'}).json()
        corrected=client.post('/v1/verifications',json={**BASE,'title':'Vitamin C Supplement','description':'Fictional brand. Sample listing.'}).json()
        assert denied['status']=='DENIED'
        assert corrected['status']=='APPROVED'
        assert corrected['claim_findings']==[]
        assert any(e['step']=='R-03' and e['outcome']=='passed' for e in corrected['trace'])
        assert denied['id']!=corrected['id']


def test_overclaim_with_registry_outage_stays_unknown(tmp_path,monkeypatch):
    def unavailable(reference): raise registry.RegistryUnavailable
    monkeypatch.setattr(registry,'tool_registry_lookup',unavailable)
    with TestClient(create_app(tmp_path / 'claims.sqlite3')) as client:
        result=client.post('/v1/verifications',json={**BASE,'description':'เห็นผลแน่นอนทุกคน'}).json()
        assert result['status']=='UNKNOWN'
        assert result['human_review_required'] is True


def test_concentration_percentage_alone_is_not_a_guarantee(tmp_path):
    with TestClient(create_app(tmp_path / 'claims.sqlite3')) as client:
        result=client.post('/v1/verifications',json={**BASE,'title':'Demo ingredient 100%','description':'Sample product, 30 capsules.'}).json()
        assert result['status']=='APPROVED'
        assert result['claim_findings']==[]


def test_unmapped_category_with_overclaim_stays_unknown(tmp_path):
    with TestClient(create_app(tmp_path / 'claims.sqlite3')) as client:
        result=client.post('/v1/verifications',json={**BASE,'category':'unmapped','title':'ผิวกระจ่างใสทันที 100%'}).json()
        assert result['status']=='UNKNOWN'
        assert result['human_review_required'] is True


def test_borrowed_reference_overclaim_is_denied_for_the_claim_without_a_new_registry_record(tmp_path):
    with TestClient(create_app(tmp_path / 'claims.sqlite3')) as client:
        result=client.post('/v1/verifications',json={**BASE,'product_name':'AuraFern Collagen','license_holder':'AuraFern Demo','title':'ผิวดูอ่อนวัยใน 3 วัน'}).json()
        assert result['status']=='DENIED'
        assert result['reason']=='advertising_overclaim'
        assert any(e['step']=='R-01' and e['outcome']=='failed' for e in result['trace'])
        assert result['claim_findings'][0]['phrase']=='ผิวดูอ่อนวัยใน 3 วัน'
