import re


CLAIM_PATTERN = re.compile(
    r"\b(?:treat(?:s|ing)?|cure(?:s)?|prevent(?:s|ing)?|reverse(?:s)?)\b|รักษา|ป้องกัน|ย้อน|หาย",
    re.IGNORECASE,
)


def advertising_claims(title, description, category):
    text = title + "\n" + description
    matches = [
        {"phrase": match.group(), "start": match.start(), "end": match.end()}
        for match in CLAIM_PATTERN.finditer(text)
    ]
    missing_term = category == "supplement" and "ผลิตภัณฑ์เสริมอาหาร" not in text
    return matches, missing_term
