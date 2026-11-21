import json
from .. import database as store
from contextlib import closing
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from ..workflow import Review, audit, continue_trace, edit, reevaluate, risk


router = APIRouter()


@router.get("/v1/review-queue", tags=["Reviewer"])
def queue(request: Request):
    with closing(store.connect(request.app.state.database)) as connection:
        results = [json.loads(row[0]) for row in connection.execute("SELECT result FROM verifications")]
    pending = [dict(result, risk=risk(result), audit=audit(result)) for result in results if result["human_review_required"]]
    return sorted(pending, key=lambda result: (-result["risk"]["score"], result["id"]))


@router.post(
    "/v1/verifications/{verification_id}/review",
    tags=["Reviewer"],
    summary="Record a reviewer decision",
    responses={
        404: {"description": "Verification not found"},
        409: {"description": "Mutation rejected because the audit, saved listing, or approval requirements are unmet"},
    },
)
def review(verification_id: UUID, review: Review, request: Request):
    """Recheck the listing and record the reviewer decision with a note and the current audit hash."""
    with edit(request.app.state.database, verification_id, review.chain_hash) as (connection, result, payload):
        trace = continue_trace(result)
        reevaluate(connection, result, payload, trace, request.app.state.extraction_client)
        if review.decision == "approve" and (
            result["status"] == "UNKNOWN" or any(
                rule["result"] == "fail" for rule in result["rule_results"]
            ) or result["confidence"] < 0.75
        ):
            raise HTTPException(409, "Resolve failed checks and uncertainty before approval")
        trace.add("human_review", json.dumps(dict(actor="demo-reviewer", **review.model_dump()), sort_keys=True))
        connection.execute("INSERT INTO reviews VALUES (?, ?, ?, ?, ?, ?)", (
            str(uuid4()), result["id"], review.decision, review.note, review.chain_hash, datetime.now(timezone.utc).isoformat()))
        result.update(status="APPROVED" if review.decision == "approve" else "DENIED",
            reason="reviewer_" + review.decision, confidence=1.0, human_review_required=False,
            trace=[entry.model_dump() for entry in trace.entries], chain_hash=trace.entries[-1].chain_hash)
    return result
