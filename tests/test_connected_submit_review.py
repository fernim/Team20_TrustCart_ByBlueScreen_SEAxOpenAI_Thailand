import httpx
from contextlib import closing
from backend.app import database as store
from test_connected_access import connected, login
from test_connected_workflow import setup_case
from backend.app.demo_cases import replay


def configure_checks(client, calls):
    def documents(listing, docs):
        calls.append("documents")
        return replay(listing, docs)

    def claims(text):
        calls.append("claims")
        return {"claims": []}

    client.app.state.document_assessor = documents
    client.app.state.claim_assessor = claims


def submit(client, result):
    return client.post(
        "/v1/seller/submissions/" + result["id"] + "/submit-review",
        json={"chain_hash": result["chain_hash"]},
    )


def test_submit_automatically_checks_documents_and_claims_then_routes_without_badge(
    connected,
):
    client, password = connected
    _, result = setup_case(client, password)
    calls = []
    configure_checks(client, calls)
    response = submit(client, result)
    assert response.status_code == 200, response.text
    checked = response.json()
    assert calls == ["documents", "claims"]
    assert checked["mode"] == "live"
    assert checked["status"] == "PENDING"
    assert checked["stage"] == "REVIEWER_REQUIRED" and checked["human_review_required"]
    assert checked["precheck_status"] == "APPROVED"
    assert len(checked["rule_results"]) == 5
    assert checked["document_check"]["state"] == "completed"
    assert checked["claim_check"]["state"] == "completed"
    assert not client.get("/v1/catalog/products").json()[0]["badge_eligible"]
    assert submit(client, result).json()["chain_hash"] == checked["chain_hash"]
    assert calls == ["documents", "claims"]
    login(client, password, "reviewer")
    queue = client.get("/v1/reviewer/queue?work_queue=to_review").json()
    assert any(row["id"] == checked["id"] for row in queue["items"])
    stored = client.get("/v1/reviewer/submissions/" + checked["id"]).json()
    assert stored["audit"]["valid"]
    assert stored["claim_check"] == checked["claim_check"]


def test_claim_outage_never_becomes_a_pass_and_documents_are_retained(connected):
    client, password = connected
    _, result = setup_case(client, password)
    calls = []
    configure_checks(client, calls)

    def fail(text):
        raise httpx.ReadTimeout("private provider details")

    client.app.state.claim_assessor = fail
    response = submit(client, result)
    assert response.status_code == 200
    checked = response.json()
    assert checked["status"] == "UNKNOWN" and checked["human_review_required"]
    assert checked["document_check"]["state"] == "completed"
    assert checked["claim_check"]["state"] == "unavailable"
    assert checked["assessment"]
    assert "private provider details" not in response.text
    assert not client.get("/v1/catalog/products").json()[0]["badge_eligible"]


def test_ungrounded_claims_are_dropped_and_stale_submits_never_call_provider(connected):
    client, password = connected
    product, result = setup_case(client, password)
    calls = []
    configure_checks(client, calls)
    client.app.state.claim_assessor = lambda text: {
        "claims": [{"phrase": "invented disease claim", "type": "disease_claim"}]
    }
    checked = submit(client, result).json()
    assert checked["claim_check"]["claims"] == []
    assert checked["status"] == "PENDING"
    client.put(
        "/v1/seller/products/" + product["id"],
        json={**product["listing"], "expected_version": 1},
    )
    calls.clear()
    assert submit(client, checked).status_code == 409
    assert calls == []


def test_missing_documents_prevent_review_submission_and_live_has_no_replay_fallback(
    connected,
):
    client, password = connected
    login(client, password)
    client.post("/v1/seller/subscription/activate")
    product = client.post(
        "/v1/seller/products", json={"title": "Plain listing", "price": "199"}
    ).json()
    result = client.post(
        "/v1/seller/products/" + product["id"] + "/submissions",
        json={"expected_version": 1},
    ).json()
    calls = []
    configure_checks(client, calls)
    assert submit(client, result).status_code == 422
    assert calls == []
    _, result = setup_case(client, password)
    del client.app.state.document_assessor
    del client.app.state.claim_assessor
    response = submit(client, result)
    assert response.status_code == 200
    assert response.json()["status"] == "UNKNOWN"
    assert response.json()["mode"] == "live"


def test_real_provider_boundary_calls_openai_for_both_checklists(
    connected, monkeypatch
):
    import json
    import secrets

    client, password = connected
    _, result = setup_case(client, password)
    monkeypatch.setenv("TRUSTCART_AI_TRANSFER_APPROVED", "true")
    monkeypatch.setenv("OPENAI_API_KEY", secrets.token_urlsafe(24))
    with closing(store.connect(client.app.state.database)) as connection:
        from backend.app.api.assessment import load_documents

        docs = load_documents(connection, result)
    document_result = replay(result["listing"], docs)
    called = []

    def post(url, **kwargs):
        assert url == "https://api.openai.com/v1/responses"
        payload = kwargs["json"]
        assert payload["store"] is False
        name = payload["text"]["format"]["name"]
        called.append(name)
        data = document_result if name == "document_readiness" else {"claims": []}
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "output": [
                    {"content": [{"type": "output_text", "text": json.dumps(data)}]}
                ]
            },
        )

    monkeypatch.setattr(httpx, "post", post)
    checked = submit(client, result).json()
    assert called == ["document_readiness", "listing_claims"]
    assert checked["status"] == "PENDING" and checked["precheck_status"] == "APPROVED"


def test_grounded_claim_failure_and_missing_check_cannot_be_overridden(connected):
    client, password = connected
    _, result = setup_case(client, password, "overclaim")
    configure_checks(client, [])
    checked = submit(client, result).json()
    assert checked["status"] == "DENIED"
    assert checked["stage"] == "REVIEWER_REQUIRED"
    assert any(
        rule["rule"] == "R-03" and rule["result"] == "fail"
        for rule in checked["rule_results"]
    )
    _, result = setup_case(client, password)
    configure_checks(client, [])
    client.app.state.claim_assessor = lambda _: {"claims": "invalid structured data"}
    checked = submit(client, result).json()
    assert (
        checked["claim_check"]["state"] == "unavailable"
        and checked["status"] == "UNKNOWN"
    )
    login(client, password, "reviewer")
    assert (
        client.post(
            "/v1/reviewer/submissions/" + checked["id"] + "/decision",
            json={
                "chain_hash": checked["chain_hash"],
                "decision": "approve",
                "note": "Attempt incomplete approval",
            },
        ).status_code
        == 409
    )


def test_review_cannot_skip_unrun_checks_even_with_confirmed_documents(connected):
    client, password = connected
    product, result = setup_case(client, password)
    login(client, password, "reviewer")
    response = client.post(
        "/v1/reviewer/submissions/" + result["id"] + "/decision",
        json={
            "chain_hash": result["chain_hash"],
            "decision": "approve",
            "note": "Attempt to skip automatic checks",
            "confirmed_documents": [d["id"] for d in result["documents"]],
            "confirmed_fields": {
                key: product["listing"][key]
                for key in ("product_name", "registration_reference", "license_holder")
            },
        },
    )
    assert response.status_code == 409
    assert not client.get("/v1/catalog/products").json()[0]["badge_eligible"]
