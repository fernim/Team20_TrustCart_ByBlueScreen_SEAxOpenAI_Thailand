import json
import sqlite3
from collections import Counter
from contextlib import closing

from fastapi import APIRouter, Depends, Request

from ..demo_access import REVIEWER_ACCESS_RESPONSES, require_demo_reviewer
from ..workflow import audit

router = APIRouter(
    dependencies=[Depends(require_demo_reviewer)],
    responses=REVIEWER_ACCESS_RESPONSES,
)

@router.get("/v1/agency/summary", tags=["Agency"])
def agency_summary(request: Request):
    """Aggregate stored synthetic decisions without seller identities or document contents."""
    statuses, categories, days, failed_rules, phrases = (Counter() for _ in range(5))
    valid = silent = total = 0
    with closing(sqlite3.connect(request.app.state.database)) as connection:
        for raw_result, raw_listing in connection.execute("SELECT result, listing FROM verifications"):
            result = json.loads(raw_result)
            listing = json.loads(raw_listing) if raw_listing else {}
            total += 1
            statuses[result["status"]] += 1
            categories[listing.get("category", "legacy")] += 1
            days[result["trace"][0]["at"][:10] if result["trace"] else "unknown"] += 1
            valid += int(audit(result)["valid"])
            failures = [rule for rule in result.get("rule_results", []) if rule["result"] == "fail"]
            failed_rules.update(rule["rule"] for rule in failures)
            silent += int(result["status"] == "APPROVED" and (bool(failures) or result["confidence"] < 0.75))
            for rule in result.get("rule_results", []):
                if rule["rule"] == "R-03":
                    phrases.update(match["phrase"] for match in (rule.get("evidence") or {}).get("matches", []))
    return dict(total=total, statuses=dict(statuses), by_category=dict(categories), by_day=dict(days),
        failed_rules=dict(failed_rules), top_claim_phrases=phrases.most_common(10),
        valid_audits=valid, audit_validity_rate=valid / total if total else None,
        silent_passes=silent, synthetic=True, disclaimer="Synthetic data. Demonstration decision support.")
