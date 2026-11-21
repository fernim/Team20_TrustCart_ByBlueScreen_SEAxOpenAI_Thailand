from collections import Counter
from backend.app.registry import demo_listings
from backend.app.verification import Listing, Trace, evaluate_rules


def test_dataset_coverage_and_integrity():
    listings = demo_listings()
    assert len(listings) == 40
    counts = Counter(case["expected_status"] for case in listings.values())
    assert min(counts[status] for status in ("APPROVED", "PENDING", "DENIED", "UNKNOWN")) >= 5
    assert {case["group"] for case in listings.values()} >= {f"G{number}" for number in range(1, 14)}
    assert {case["language"] for case in listings.values()} == {"th", "en", "mixed"}
    assert all("expected_failures" in case and "llm_dependent" in case for case in listings.values())


def test_dataset_decisions_and_outage_invariants():
    for key, case in demo_listings().items():
        listing = Listing(**case)
        status, reason, rules = evaluate_rules(listing, Trace())
        assert status.value == case["expected_status"], (key, reason)
        failures = {rule["rule"] for rule in rules if rule["result"] == "fail"}
        assert failures == set(case["expected_failures"]), (key, failures)
        if status.value == "APPROVED":
            assert not failures
        listing.simulate_registry_outage = True
        status, _, _ = evaluate_rules(listing, Trace())
        assert status.value == "UNKNOWN", key
