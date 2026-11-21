import re
import json
from pathlib import Path


RULES = json.loads((Path(__file__).resolve().parent.parent / "data" / "claim_rules.json").read_text(encoding="utf-8"))
CLAIM_PATTERN = re.compile(
    RULES["english_pattern"] + "|" + "|".join(re.escape(phrase) for phrase in RULES["thai_phrases"]),
    re.IGNORECASE)


def advertising_claims(title, description, category):
    text = title + "\n" + description
    matches = [
        {"phrase": match.group(), "start": match.start(), "end": match.end()}
        for match in CLAIM_PATTERN.finditer(text)
    ]
    missing_term = category == "supplement" and RULES["supplement_term"] not in text
    return matches, missing_term
