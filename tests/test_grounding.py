from backend.app.llm import extract_claims


def test_extraction_drops_invented_phrases_and_status():
    client = lambda text: {"claims": [{"phrase": "invented", "type": "disease"}, {"phrase": "prevents obesity", "type": "disease"}], "status": "APPROVED"}
    assert extract_claims("This prevents obesity", client) == [{"phrase": "prevents obesity", "type": "disease"}]


def test_extraction_disabled_and_failure_are_safe():
    assert extract_claims("ordinary listing") == []
    def failed(text):
        raise TimeoutError()
    assert extract_claims("ordinary listing", failed) == []


def test_grounded_extraction_reaches_rules(tmp_path):
    from backend.app.main import create_app
    from backend.app.registry import demo_listings
    from fastapi.testclient import TestClient
    app = create_app(tmp_path / "db.sqlite3")
    app.state.extraction_client = lambda text: {"claims": [
        {"phrase": "Invented disease text", "type": "disease_claim"},
        {"phrase": "balances disease", "type": "disease_claim"},
    ]}
    with TestClient(app) as client:
        listing = demo_listings()["L2"]
        listing["title"] = "balances disease"
        result = client.post("/v1/verifications", json=listing).json()
        assert result["status"] == "DENIED"
        rule = next(rule for rule in result["rule_results"] if rule["rule"] == "R-03")
        assert rule["evidence"]["matches"][0]["phrase"] == "balances disease"
