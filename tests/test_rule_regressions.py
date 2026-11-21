import pytest
from backend.app.rules import advertising_claims


@pytest.mark.parametrize("text,category", [
    ("หายใจสะดวก", "supplement"),
    ("สินค้าไม่หาย ส่งไว", "supplement"),
    ("ป้องกันแสงแดด SPF50", "cosmetic"),
])
def test_ordinary_thai_phrases(text, category):
    assert advertising_claims("", text, category)[0] == []


@pytest.mark.parametrize("text", ["ย้อนกลับเบาหวาน", "รักษาโรคเบาหวาน"])
def test_thai_claim_phrases(text):
    matches, _ = advertising_claims("", text, "supplement")
    assert matches
    assert ("\n" + text)[matches[0]["start"]:matches[0]["end"]] == matches[0]["phrase"]
