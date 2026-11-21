import json
import time
from contextlib import closing
from typing import Literal, Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from .. import database as store, registry
from ..connected_store import transaction, read_submission, save_submission
from ..security import require
from ..verification import Listing, Status
from ..workflow import continue_trace
from ..document_assessment import assess_documents, validate_assessment, Fields
from ..demo_cases import replay
from .connected import require_plan
from .submissions import active_submission, check_revision, event

router = APIRouter(tags=["Document checks and reviewer decisions"])


def required_kinds(listing):
    kinds = {"label", "certificate"}
    try:
        record = registry.tool_registry_lookup(listing["registration_reference"])
    except registry.RegistryUnavailable:
        record = None
    if listing.get("advertising_permit") or record and record.permit_required:
        kinds.add("permit")
    return kinds


def load_documents(connection, result):
    docs = []
    for meta in result["documents"]:
        row = connection.execute(
            "SELECT content FROM tc_documents WHERE id=?", (meta["id"],)
        ).fetchone()
        if not row:
            raise HTTPException(409, "A document is unavailable")
        docs.append({**meta, "content": bytes(row[0])})
    return docs


def evaluate(result, assessment, client, confirmed=None):
    from ..verification import evaluate_rules

    trace = continue_trace(result)
    declaration = confirmed
    if declaration is None and assessment:
        primary = next(
            (
                d
                for d in assessment["documents"]
                if d["document_id"]
                == next(
                    (
                        meta["id"]
                        for meta in result["documents"]
                        if meta["kind"] == "certificate"
                    ),
                    "",
                )
            ),
            None,
        )
        declaration = primary["fields"] if primary else None
    status, reason, rules = evaluate_rules(
        Listing(**result["listing"]), trace, client, declarations=declaration
    )
    uncertainty = False
    if confirmed is None:
        uncertainty = (
            not assessment
            or assessment["confidence"] < 0.75
            or bool(assessment["missing"] or assessment["inconsistencies"])
            or any(
                not d["readable"]
                or d["uncertainties"]
                or any(
                    d["fields"][key].strip().casefold()
                    != result["listing"][key].strip().casefold()
                    for key in (
                        "product_name",
                        "license_holder",
                        "registration_reference",
                    )
                )
                for d in assessment["documents"]
            )
        )
        permit = next((d for d in result["documents"] if d["kind"] == "permit"), None)
        if permit and assessment:
            finding = next(
                (
                    d
                    for d in assessment["documents"]
                    if d["document_id"] == permit["id"]
                ),
                {},
            )
            uncertainty = uncertainty or finding.get("advertising_permit") != result[
                "listing"
            ].get("advertising_permit")
        if result["listing"]["category"] != "supplement":
            uncertainty = True
    if status == Status.APPROVED and uncertainty:
        status, reason = Status.PENDING, "document_review_required"
    stage = (
        "COMPLETED"
        if status in (Status.APPROVED, Status.DENIED)
        else "UNAVAILABLE" if status == Status.UNKNOWN else "REVIEWER_REQUIRED"
    )
    confidence = (
        (assessment["confidence"] if assessment and confirmed is None else 1.0)
        if status == Status.APPROVED
        else (
            1.0 if status == Status.DENIED else 0.0 if status == Status.UNKNOWN else 0.6
        )
    )
    trace.add(
        "document_readiness",
        json.dumps(
            {"uncertain": uncertainty, "reviewer_confirmed": confirmed is not None}
        ),
    )
    trace.add("decision", reason)
    result.update(
        status=status.value,
        reason=reason,
        stage=stage,
        confidence=confidence,
        human_review_required=status in (Status.PENDING, Status.UNKNOWN),
        rule_results=rules,
        trace=[e.model_dump() for e in trace.entries],
        chain_hash=trace.entries[-1].chain_hash,
    )


class Run(BaseModel):
    chain_hash: str = Field(min_length=64, max_length=64)
    mode: Literal["live", "replay"] = "live"


@router.post("/v1/seller/submissions/{submission_id}/run")
def run(submission_id: UUID, payload: Run, request: Request):
    user = require(request, "seller")
    with transaction(request.app.state.database) as connection:
        result, _ = active_submission(connection, submission_id, user["shop_id"])
        require_plan(connection, user["shop_id"])
        if (
            result.get("last_run_hash") == payload.chain_hash
            and result.get("mode") == payload.mode
            and result["stage"] != "AI_CHECKING"
        ):
            return result
        check_revision(result, payload.chain_hash)
        if (
            result["stage"] == "AI_CHECKING"
            and result.get("lease_until", 0) > time.time()
        ):
            raise HTTPException(409, "Assessment is already running")
        if result["stage"] not in ("WAITING_DOCUMENTS", "UNAVAILABLE", "AI_CHECKING"):
            raise HTTPException(
                409, "Create a new submission to run another assessment"
            )
        missing = required_kinds(result["listing"]) - {
            d["kind"] for d in result["documents"]
        }
        if missing:
            raise HTTPException(422, "Missing documents: " + ", ".join(sorted(missing)))
        documents = load_documents(connection, result)
        token = str(uuid4())
        result.update(
            stage="AI_CHECKING",
            status="PENDING",
            confidence=0.0,
            human_review_required=False,
            mode=payload.mode,
            run_token=token,
            lease_until=time.time() + 60,
            last_run_hash=payload.chain_hash,
        )
        event(
            result,
            "assessment_started",
            {
                "actor": user["id"],
                "mode": payload.mode,
                "chain_hash": payload.chain_hash,
            },
        )
        save_submission(connection, result)
    # Network/vision processing occurs outside the database transaction.
    try:
        assessor = getattr(request.app.state, "document_assessor", assess_documents)
        raw = (
            replay(result["listing"], documents)
            if payload.mode == "replay"
            else assessor(result["listing"], documents)
        )
        assessment = validate_assessment(raw, documents)
        result["assessment"] = assessment
        event(
            result,
            "document_assessment",
            {"mode": payload.mode, "findings": assessment},
        )
        evaluate(result, assessment, request.app.state.extraction_client)
    except Exception as error:
        # Do not expose provider bodies, document text, credentials or network details.
        result.update(
            status="UNKNOWN",
            stage="UNAVAILABLE",
            reason="document_assessment_unavailable",
            confidence=0.0,
            human_review_required=True,
            assessment=None,
        )
        event(
            result,
            "assessment_unavailable",
            {
                "error_type": type(error).__name__,
                "retryable": True,
                "mode": payload.mode,
            },
        )
    with transaction(request.app.state.database) as connection:
        current, _ = active_submission(connection, submission_id, user["shop_id"])
        if current.get("run_token") != token or current["stage"] != "AI_CHECKING":
            raise HTTPException(
                409, "Assessment was superseded; its result was not applied"
            )
        result.pop("run_token", None)
        result.pop("lease_until", None)
        save_submission(connection, result)
    return result


class Decision(BaseModel):
    chain_hash: str = Field(min_length=64, max_length=64)
    decision: Literal["approve", "deny", "request_documents"]
    note: str = Field(min_length=3, max_length=2000)
    confirmed_fields: Optional[Fields] = None
    confirmed_documents: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("note")
    @classmethod
    def nonempty_note(cls, value):
        if len(value.strip()) < 3:
            raise ValueError("Provide a meaningful decision reason")
        return value.strip()


@router.post("/v1/reviewer/submissions/{submission_id}/decision")
def decision(submission_id: UUID, payload: Decision, request: Request):
    user = require(request, "reviewer")
    with transaction(request.app.state.database) as connection:
        result, _ = active_submission(connection, submission_id)
        check_revision(result, payload.chain_hash)
        if (
            result["stage"] == "AI_CHECKING"
            and result.get("lease_until", 0) > time.time()
        ):
            raise HTTPException(
                409, "Wait for the active assessment or its retry timeout"
            )
        if payload.decision == "approve":
            if any(
                r["rule"] == "R-03" and r["result"] == "fail"
                for r in result["rule_results"]
            ):
                raise HTTPException(
                    409,
                    "Correct prohibited claims in a new listing revision before approval",
                )
            required = required_kinds(result["listing"])
            confirmed = {
                d["kind"]
                for d in result["documents"]
                if d["id"] in payload.confirmed_documents
            }
            if not required.issubset(confirmed) or payload.confirmed_fields is None:
                raise HTTPException(
                    422,
                    "Inspect and confirm every required document and identity field",
                )
            # No AI call while holding locks: manual confirmation plus deterministic rules.
            evaluate(
                result,
                result.get("assessment"),
                None,
                confirmed=payload.confirmed_fields.model_dump(),
            )
            if result["status"] != "APPROVED" or any(
                rule["result"] == "fail" for rule in result["rule_results"]
            ):
                raise HTTPException(
                    409,
                    "Resolve registry, category, claims and evidence failures before approval",
                )
        elif payload.decision == "deny":
            evaluate(result, result.get("assessment"), None)
            if result["status"] == "UNKNOWN":
                raise HTTPException(
                    409,
                    "Unavailable registry information cannot establish a denial; request evidence instead",
                )
            result.update(
                status="DENIED",
                stage="COMPLETED",
                confidence=1.0,
                human_review_required=False,
            )
        else:
            result.update(
                status="PENDING",
                stage="SELLER_ACTION",
                confidence=0.6,
                human_review_required=False,
            )
        result["reason"] = "reviewer_" + payload.decision
        result["review_note"] = payload.note.strip()
        event(result, "human_review", {"actor": user["id"], **payload.model_dump()})
        save_submission(connection, result)
        return result
