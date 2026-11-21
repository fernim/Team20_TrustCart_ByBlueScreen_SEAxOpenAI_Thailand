import hashlib
import json
from contextlib import closing
from typing import Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from .. import database as store
from ..connected_store import (
    transaction,
    read_product,
    read_submission,
    save_submission,
    now,
)
from ..security import require
from ..verification import Trace
from ..workflow import audit, continue_trace
from .connected import require_plan

router = APIRouter(tags=["Product submissions"])


def event(result, step, outcome):
    trace = continue_trace(result)
    trace.add(step, json.dumps(outcome, ensure_ascii=False, sort_keys=True))
    result.update(
        trace=[entry.model_dump() for entry in trace.entries],
        chain_hash=trace.entries[-1].chain_hash,
    )


def check_revision(result, chain_hash):
    if result["chain_hash"] != chain_hash or not audit(result)["valid"]:
        raise HTTPException(
            409, "Submission changed or audit invalid. Reload before acting."
        )


def active_submission(connection, submission_id, shop_id=None):
    # Resolve the immutable parent without locking the child first. Every writer
    # locks owner -> product -> submission, avoiding reversed PostgreSQL locks.
    parent = connection.execute(
        "SELECT product_id FROM tc_submissions WHERE id IN (?)", (str(submission_id),)
    ).fetchone()
    if not parent:
        raise HTTPException(404, "Submission not found")
    product, owner = read_product(connection, parent[0], shop_id)
    result = read_submission(connection, submission_id, shop_id)
    if owner[1] != result["id"] or product["version"] != result["product_version"]:
        raise HTTPException(409, "This submission has been superseded")
    return result, product


class SubmissionRequest(BaseModel):
    expected_version: int = Field(ge=1)
    chain_hash: Optional[str] = None


@router.post("/v1/seller/products/{product_id}/submissions", status_code=201)
def request_submission(product_id: UUID, payload: SubmissionRequest, request: Request):
    user = require(request, "seller")
    with transaction(request.app.state.database) as connection:
        product, owner = read_product(connection, product_id, user["shop_id"])
        require_plan(connection, user["shop_id"])
        if product["version"] != payload.expected_version:
            raise HTTPException(409, "Product changed. Reload before submitting.")
        previous = read_submission(connection, owner[1]) if owner[1] else None
        if previous:
            check_revision(previous, payload.chain_hash)
            if previous["stage"] == "WAITING_DOCUMENTS":
                return previous
        revision = (
            connection.execute(
                "SELECT COUNT(*) FROM tc_submissions WHERE product_id=?",
                (str(product_id),),
            ).fetchone()[0]
            + 1
        )
        result = dict(
            id=str(uuid4()),
            product_id=str(product_id),
            shop_id=user["shop_id"],
            product_version=product["version"],
            revision=revision,
            listing=product["listing"],
            listing_title=product["listing"]["title"],
            stage="WAITING_DOCUMENTS",
            status="PENDING",
            confidence=0.0,
            human_review_required=False,
            reason="documents_required",
            registry_source="synthetic",
            documents=list(previous["documents"]) if previous else [],
            rule_results=[],
            assessment=None,
            mode=None,
            created_at=now(),
            trace=[],
            chain_hash="",
            previous_submission_id=previous["id"] if previous else None,
        )
        from .assessment import required_kinds

        result["required_documents"] = sorted(required_kinds(result["listing"]))
        trace = Trace()
        trace.add(
            "submission_snapshot",
            json.dumps(
                dict(
                    actor=user["id"],
                    product_version=product["version"],
                    listing_sha256=hashlib.sha256(
                        json.dumps(product["listing"], sort_keys=True).encode()
                    ).hexdigest(),
                    previous_chain_hash=previous["chain_hash"] if previous else None,
                )
            ),
        )
        result.update(
            trace=[e.model_dump() for e in trace.entries],
            chain_hash=trace.entries[-1].chain_hash,
        )
        if previous:
            event(
                previous,
                "submission_superseded",
                {
                    "actor": user["id"],
                    "next_submission": result["id"],
                    "chain_hash": payload.chain_hash,
                },
            )
            previous["stage"] = "SUPERSEDED"
            save_submission(connection, previous)
        connection.execute(
            "INSERT INTO tc_submissions VALUES (?,?,?,?,?,?)",
            (
                result["id"],
                str(product_id),
                user["shop_id"],
                revision,
                json.dumps(result),
                result["created_at"],
            ),
        )
        connection.execute(
            "UPDATE tc_owners SET active_submission=? WHERE id=?",
            (result["id"], str(product_id)),
        )
        return result


@router.get("/v1/seller/submissions/{submission_id}")
def seller_submission(submission_id: UUID, request: Request):
    user = require(request, "seller")
    with closing(store.connect(request.app.state.database)) as connection:
        return read_submission(connection, submission_id, user["shop_id"])


@router.get("/v1/seller/products/{product_id}/history")
def history(product_id: UUID, request: Request):
    user = require(request, "seller")
    with closing(store.connect(request.app.state.database)) as connection:
        read_product(connection, product_id, user["shop_id"])
        return [
            json.loads(row[0])
            for row in connection.execute(
                "SELECT result FROM tc_submissions WHERE product_id=? ORDER BY revision DESC",
                (str(product_id),),
            ).fetchall()
        ]


@router.get("/v1/reviewer/submissions/{submission_id}")
def reviewer_submission(submission_id: UUID, request: Request):
    require(request, "reviewer")
    with closing(store.connect(request.app.state.database)) as connection:
        result = read_submission(connection, submission_id)
        result["audit"] = audit(result)
        return result


class StartReview(BaseModel):
    chain_hash: str = Field(min_length=64, max_length=64)


@router.post('/v1/reviewer/submissions/{submission_id}/start-review')
def start_review(submission_id: UUID, payload: StartReview, request: Request):
    user = require(request, 'reviewer')
    with transaction(request.app.state.database) as connection:
        result, _ = active_submission(connection, submission_id)
        check_revision(result, payload.chain_hash)
        if result['stage'] not in ('REVIEWER_REQUIRED', 'UNAVAILABLE'):
            raise HTTPException(409, 'Only a current case awaiting staff review can be started')
        event(result, 'review_started', {'actor': user['id'], 'chain_hash': payload.chain_hash})
        result['stage'] = 'IN_REVIEW'
        save_submission(connection, result)
        return result
