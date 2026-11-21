"""Offline regression tests for the deterministic R-03 phrase scanner."""

import pytest

from backend.app.claims import find_overclaims


@pytest.mark.parametrize("phrase,code", [
    ("INSTANTLY BRIGHTER SKIN", "instant_effect"),
    ("Younger-looking skin in  2 days", "rapid_appearance_change"),
    ("younger looking skin in 1 day", "rapid_appearance_change"),
    ("ผิวดูอ่อนวัยใน ๓ วัน", "rapid_appearance_change"),
    ("100%   GUARANTEED", "guaranteed_results"),
])
@pytest.mark.parametrize("source", ["title", "description"])
def test_matches_keep_literal_text_and_source(phrase, code, source):
    listing = {"title": "Ordinary sample", "description": "30 capsules."}
    listing[source] = "Sample: " + phrase + "."

    findings = find_overclaims(**listing)

    assert len(findings) == 1
    finding = findings[0]
    assert finding.phrase == phrase
    assert finding.source == source
    assert finding.code == code
    assert finding.rule_id == "R-03"
    assert finding.reason_th and finding.reason_en


def test_repeated_claims_preserve_each_occurrence_and_source():
    phrase = "guaranteed for everyone"
    findings = find_overclaims(phrase + "; " + phrase, phrase.upper())

    assert [(item.source, item.phrase) for item in findings] == [
        ("title", phrase), ("title", phrase), ("description", phrase.upper()),
    ]


@pytest.mark.parametrize("title,description", [
    ("", ""),
    ("Ingredient 100%", "Sample product, 30 capsules."),
    ("Vitamin C Supplement", "Fictional brand. Sample listing."),
])
def test_ordinary_copy_does_not_invent_findings(title, description):
    assert find_overclaims(title, description) == []
