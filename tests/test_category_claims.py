from dataclasses import replace

import pytest

from backend.app import registry
from backend.app.rules import RULES
from backend.app.verification import Listing, Trace, evaluate_rules


def category_rule(listing):
    status, _, rules = evaluate_rules(Listing(**listing), Trace())
    return status.value, next(rule for rule in rules if rule["rule"] == "R-02")


@pytest.mark.parametrize("phrase", ["ยารักษา", "ขาวถาวร", "TREATS HYPERTENSION", "Cures ADHD"])
def test_configured_supplement_claims_fail_category_rule(phrase):
    listing = {**registry.demo_listings()["L2"], "title": phrase}
    status, rule = category_rule(listing)
    assert status == "DENIED" and rule["result"] == "fail"
    assert phrase.casefold() in {value.casefold() for value in RULES["category_claims"]["supplement"]}


@pytest.mark.parametrize("phrase", ["หายใจสะดวก", "สินค้าไม่หาย ส่งไว", "Ordinary product description"])
def test_ordinary_copy_passes_category_rule(phrase):
    status, rule = category_rule({**registry.demo_listings()["L2"], "title": phrase})
    assert status == "APPROVED" and rule["result"] == "pass"


def test_category_claim_policy_uses_registry_category_and_configuration(monkeypatch):
    listing = {**registry.demo_listings()["L2"], "title": "Fixture category restriction"}
    record = registry.tool_registry_lookup(listing["registration_reference"])
    monkeypatch.setitem(RULES, "category_claims", {"cosmetic": ["fixture category restriction"]})
    assert category_rule(listing)[1]["result"] == "pass"
    monkeypatch.setattr(registry, "tool_registry_lookup", lambda reference: replace(record, category="cosmetic"))
    listing["category"] = "cosmetic"
    assert category_rule(listing)[1]["result"] == "fail"
    # A seller's category cannot choose a different claim policy.
    listing["category"] = "supplement"
    assert category_rule(listing)[1]["evidence"]["registered_category"] == "cosmetic"
    monkeypatch.setitem(RULES, "category_claims", {"cosmetic": []})
    listing["category"] = "cosmetic"
    assert category_rule(listing)[1]["result"] == "pass"


def test_category_claims_never_approve_an_outage():
    listing = {**registry.demo_listings()["L2"], "title": "cures adhd", "simulate_registry_outage": True}
    status, rule = category_rule(listing)
    assert status == "UNKNOWN" and rule["result"] == "skip"
