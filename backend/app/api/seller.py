import hashlib
import json
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from typing_extensions import Annotated

from ..rules import RULES, advertising_claims
from ..verification import Listing, ListingText, Trace
from ..workflow import Revision, continue_trace, edit, reevaluate


router = APIRouter()


@router.post("/v1/verifications/{verification_id}/evidence", tags=["Seller"])
async def evidence(
    request: Request,
    verification_id: UUID,
    chain_hash: Annotated[str, Form()],
    product_name: Annotated[ListingText, Form()],
    license_holder: Annotated[ListingText, Form()],
    registration_reference: Annotated[ListingText, Form()],
    label: UploadFile = File(...),
    certificate: UploadFile = File(...),
):
    """Upload synthetic demo evidence. Only file hashes and declared product fields are stored."""
    hashes = []
    for kind, upload in (("label", label), ("certificate", certificate)):
        digest = hashlib.sha256()
        size = 0
        while True:
            chunk = await upload.read(65536)
            if not chunk:
                break
            size += len(chunk)
            if size > 2 * 1024 * 1024:
                raise HTTPException(413, "Maximum evidence size is 2 MB per file")
            digest.update(chunk)
        if size == 0:
            raise HTTPException(422, "Evidence files must contain data")
        hashes.append((kind, digest.hexdigest()))
    declarations = dict(product_name=product_name, license_holder=license_holder, registration_reference=registration_reference)
    with edit(request.app.state.database, verification_id, chain_hash) as (connection, result, payload):
        trace = continue_trace(result)
        for kind, digest in hashes:
            connection.execute("INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?)", (
                str(uuid4()), str(verification_id), kind, digest, json.dumps(declarations), datetime.now(timezone.utc).isoformat()))
            trace.add("evidence", json.dumps({"kind": kind, "sha256": digest, "chain_hash": chain_hash}))
        reevaluate(connection, result, payload, trace, request.app.state.extraction_client)
    return result


@router.post("/v1/verifications/{verification_id}/recheck", tags=["Seller"])
def recheck(verification_id: UUID, revision: Revision, request: Request):
    with edit(request.app.state.database, verification_id, revision.chain_hash) as (connection, result, payload):
        trace = continue_trace(result)
        trace.add("recheck", "Requested with chain_hash " + revision.chain_hash)
        reevaluate(connection, result, payload, trace, request.app.state.extraction_client)
    return result


@router.post("/v1/listings/suggest-copy", tags=["Seller"])
def suggest_copy(listing: Listing):
    """Return a minimal factual template and screen it with R-03. Submit it for a fresh decision."""
    candidate = listing.model_copy(update={
        "title": "Product listing",
        "description": RULES["supplement_term"] if listing.category.casefold() == "supplement" else "Product details",
    })
    matches, missing = advertising_claims(candidate.title, candidate.description, candidate.category.casefold())
    trace = Trace()
    trace.add("copy_template", "Minimal factual template generated")
    trace.add("R-03", "pass" if not matches and not missing else "fail")
    return {"listing": candidate.model_dump(), "screened": not matches and not missing,
        "requires_verification": True, "method": "deterministic_template", "synthetic": True,
        "trace": [entry.model_dump() for entry in trace.entries], "chain_hash": trace.entries[-1].chain_hash}
