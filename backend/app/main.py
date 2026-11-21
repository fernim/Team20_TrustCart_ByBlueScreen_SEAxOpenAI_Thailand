import hashlib
import json
import sqlite3
from contextlib import asynccontextmanager, closing
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional, Tuple
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field, StringConstraints
from typing_extensions import Annotated

from . import registry
from .rules import advertising_claims
from .llm import extract_claims, openai_claim_client


ListingText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
SUPPORTED_CATEGORIES = {"supplement", "cosmetic"}


class Listing(BaseModel):
    registration_reference: ListingText
    product_name: ListingText
    license_holder: ListingText
    category: ListingText
    title: str = Field(default="", max_length=2000)
    description: str = Field(default="", max_length=10000)
    simulate_registry_outage: bool = Field(default=False, description="Demo-only, request-scoped outage simulation. Forces UNKNOWN.")
    advertising_permit: Optional[str] = Field(default=None, max_length=200)


class Status(str, Enum):
    APPROVED = "APPROVED"
    PENDING = "PENDING"
    DENIED = "DENIED"
    UNKNOWN = "UNKNOWN"


class TraceEntry(BaseModel):
    step: str
    outcome: str
    at: str
    previous_hash: Optional[str]
    chain_hash: str


class Trace:
    def __init__(self, entries=None):
        self.entries = list(entries or [])

    def add(self, step: str, outcome: str) -> None:
        event = {
            "step": step,
            "outcome": outcome,
            "at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "previous_hash": self.entries[-1].chain_hash if self.entries else None,
        }
        digest = hashlib.sha256(json.dumps(event, sort_keys=True).encode("utf-8"))
        self.entries.append(TraceEntry(**event, chain_hash=digest.hexdigest()))


class Verification(BaseModel):
    id: UUID
    status: Status
    reason: str
    registry_source: str = "synthetic"
    confidence: float
    human_review_required: bool
    trace: list[TraceEntry]
    chain_hash: str
    rule_results: list[dict] = Field(default_factory=list)


def evaluate_rules(listing: Listing, trace: Trace, extraction_client=None):
    results = []

    def add(rule, result, reason_en, reason_th, evidence=None):
        results.append(dict(rule=rule, result=result, reason_en=reason_en, reason_th=reason_th, evidence=evidence))
        trace.add(rule, json.dumps(results[-1], sort_keys=True, ensure_ascii=False))

    status, reason = evaluate(listing, trace)
    add("R-01", "skip" if status == Status.UNKNOWN else "fail" if reason in {"evidence_requested", "registration_inactive"} else "pass",
        "Registration identity check", "ตรวจสอบข้อมูลทะเบียน")
    add("R-02", "skip" if status == Status.UNKNOWN else "fail" if reason == "registration_category_mismatch" else "pass",
        "Registered category check", "ตรวจสอบประเภทผลิตภัณฑ์")
    if listing.title or listing.description:
        matches, missing = advertising_claims(listing.title, listing.description, listing.category.casefold())
        text = listing.title + "\n" + listing.description
        extracted = extract_claims(text, extraction_client)
        trace.add("claim_extraction", json.dumps(extracted, ensure_ascii=False, sort_keys=True))
        for claim in extracted:
            if claim["type"] == "disease_claim" and not any(item["phrase"] == claim["phrase"] for item in matches):
                start = text.index(claim["phrase"])
                matches.append({"phrase": claim["phrase"], "start": start, "end": start + len(claim["phrase"])})
        failed = bool(matches) or missing
        add("R-03", "fail" if failed else "pass", "Advertising text check", "ตรวจสอบข้อความโฆษณา",
            dict(matches=matches, missing_required_term=missing))
        if failed and status == Status.APPROVED:
            status, reason = Status.DENIED, "advertising_claim_failed"
    else:
        add("R-03", "skip", "No advertising text submitted", "ไม่ได้ส่งข้อความโฆษณา")
    permit_conflict = False
    if listing.advertising_permit and status != Status.UNKNOWN:
        record = registry.tool_registry_lookup(listing.registration_reference)
        permit_conflict = bool(record and listing.advertising_permit != record.advertising_permit)
    add("R-04", "fail" if permit_conflict else "pass" if listing.advertising_permit else "skip",
        "Permit differs from registry" if permit_conflict else "Permit comparison against synthetic registry",
        "ตรวจสอบใบอนุญาตโฆษณา")
    if permit_conflict and status == Status.APPROVED:
        status, reason = Status.PENDING, "permit_conflict"
    add("R-05", "skip", "Seller evidence not submitted", "ยังไม่ได้ส่งหลักฐาน")
    return status, reason, results


def evaluate(listing: Listing, trace: Trace) -> Tuple[Status, str]:
    category = listing.category.casefold()
    if category not in SUPPORTED_CATEGORIES:
        trace.add("category_mapping", "unmapped")
        return Status.UNKNOWN, "category_unmapped"
    trace.add("category_mapping", "mapped")
    try:
        if listing.simulate_registry_outage:
            raise registry.RegistryUnavailable
        record = registry.tool_registry_lookup(listing.registration_reference)
    except registry.RegistryUnavailable:
        trace.add("registry_lookup", "unavailable")
        return Status.UNKNOWN, "registry_unavailable"
    if record is None:
        trace.add("registry_lookup", "missing")
        return Status.UNKNOWN, "reference_missing"
    trace.add("registry_lookup", "found")
    if record.category not in SUPPORTED_CATEGORIES:
        trace.add("registry_category_mapping", "unmapped")
        return Status.UNKNOWN, "registry_category_unmapped"
    trace.add("registry_category_mapping", "mapped")

    if not record.active:
        trace.add("registry_identity", "inactive")
        return Status.DENIED, "registration_inactive"

    same_identity = (
        record.active
        and listing.product_name.casefold() == record.product_name.casefold()
        and listing.license_holder.casefold() == record.license_holder.casefold()
    )
    trace.add("registry_identity", "matched" if same_identity else "failed")
    if not same_identity:
        return Status.PENDING, "evidence_requested"
    category_matches = category == record.category
    trace.add("registry_category", "matched" if category_matches else "failed")
    if not category_matches:
        return Status.DENIED, "registration_category_mismatch"
    return Status.APPROVED, "registration_identity_and_category_matched"


def create_app(database: Path) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                "CREATE TABLE IF NOT EXISTS verifications (id TEXT PRIMARY KEY, result TEXT NOT NULL)"
            )
            columns = {row[1] for row in connection.execute("PRAGMA table_info(verifications)")}
            if "listing" not in columns:
                connection.execute("ALTER TABLE verifications ADD COLUMN listing TEXT")
            connection.execute("CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, verification_id TEXT NOT NULL, kind TEXT NOT NULL, sha256 TEXT NOT NULL, declarations TEXT NOT NULL, created_at TEXT NOT NULL)")
            connection.execute("CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, verification_id TEXT NOT NULL, decision TEXT NOT NULL, note TEXT NOT NULL, prev_chain_hash TEXT NOT NULL, created_at TEXT NOT NULL)")
        yield

    service = FastAPI(title="TrustCart Baseline Lead", version="0.1.0", lifespan=lifespan)
    service.state.extraction_client = openai_claim_client

    @service.post("/v1/verifications", status_code=201, response_model=Verification)
    def submit(listing: Listing, response: Response) -> Verification:
        trace = Trace()
        status, reason, rule_results = evaluate_rules(listing, trace, service.state.extraction_client)
        confidence = {Status.UNKNOWN: 0.0, Status.PENDING: 0.60}.get(status, 1.0)
        human_review_required = confidence < 0.75
        from .workflow import RISK_POLICY_HASH
        trace.add("risk_policy", RISK_POLICY_HASH)
        trace.add("decision", reason)
        trace.add("review_routing", "required" if human_review_required else "clear")
        result = Verification(
            id=uuid4(), status=status, reason=reason, confidence=confidence,
            human_review_required=human_review_required, trace=trace.entries,
            chain_hash=trace.entries[-1].chain_hash,
            rule_results=rule_results,
        )
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute(
                "INSERT INTO verifications (id, result, listing) VALUES (?, ?, ?)",
                (str(result.id), result.model_dump_json(), listing.model_dump_json()),
            )
        response.headers["Location"] = f"/v1/verifications/{result.id}"
        return result

    @service.get("/v1/verifications/{verification_id}", response_model=Verification)
    def retrieve(verification_id: UUID) -> Verification:
        with closing(sqlite3.connect(database)) as connection:
            row = connection.execute(
                "SELECT result FROM verifications WHERE id = ?", (str(verification_id),)
            ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Verification not found")
        return Verification.model_validate_json(row[0])

    from .workflow import install_workflow
    install_workflow(service, database)
    return service


app = create_app(Path("trustcart.sqlite3"))
