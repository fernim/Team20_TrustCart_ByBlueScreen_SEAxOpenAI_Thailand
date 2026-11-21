import sqlite3
from contextlib import closing
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request, Response

from ..verification import Listing, Status, Trace, Verification, evaluate_rules
from ..workflow import RISK_POLICY_HASH
from ..claims import find_overclaims


router = APIRouter()


@router.post(
    "/v1/verifications",
    status_code=201,
    response_model=Verification,
    tags=["Verifications"],
    summary="Submit a listing for verification",
    responses={
        201: {
            "description": "Verification saved",
            "headers": {
                "Location": {
                    "description": "Relative URL for retrieving the saved verification.",
                    "schema": {"type": "string"},
                },
            },
        },
    },
)
def submit(listing: Listing, response: Response, request: Request) -> Verification:
    """Evaluate a listing against the synthetic registry and return its decision and audit trace."""
    trace = Trace()
    status, reason, rule_results = evaluate_rules(listing, trace, request.app.state.extraction_client)
    confidence = {Status.UNKNOWN: 0.0, Status.PENDING: 0.60}.get(status, 1.0)
    human_review_required = confidence < 0.75
    trace.add("risk_policy", RISK_POLICY_HASH)
    trace.add("decision", reason)
    trace.add("review_routing", "required" if human_review_required else "clear")
    result = Verification(
        id=uuid4(), status=status, reason=reason, confidence=confidence,
        human_review_required=human_review_required, trace=trace.entries,
        chain_hash=trace.entries[-1].chain_hash,
        rule_results=rule_results,
        listing=listing, listing_title=listing.title or listing.product_name,
        claim_findings=find_overclaims(listing.title, listing.description),
    )
    with closing(sqlite3.connect(request.app.state.database)) as connection, connection:
        connection.execute(
            "INSERT INTO verifications (id, result, listing) VALUES (?, ?, ?)",
            (str(result.id), result.model_dump_json(), listing.model_dump_json()),
        )
    response.headers["Location"] = f"/v1/verifications/{result.id}"
    return result


@router.get(
    "/v1/verifications/{verification_id}",
    response_model=Verification,
    tags=["Verifications"],
    summary="Retrieve the current verification",
    responses={404: {"description": "Verification not found"}},
)
def retrieve(verification_id: UUID, request: Request) -> Verification:
    with closing(sqlite3.connect(request.app.state.database)) as connection:
        row = connection.execute(
            "SELECT result FROM verifications WHERE id = ?", (str(verification_id),)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Verification not found")
    return Verification.model_validate_json(row[0])
