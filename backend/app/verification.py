import hashlib
import json
import re
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Tuple
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints, field_validator
from typing_extensions import Annotated

from . import registry
from .llm import extract_claims
from .rules import RULES, advertising_claims
from .claims import ClaimFinding, find_overclaims
from .media import validate_images


ListingText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
SUPPORTED_CATEGORIES = {"supplement", "cosmetic", "drug"}


class Listing(BaseModel):
    registration_reference: ListingText
    product_name: ListingText
    license_holder: ListingText
    category: ListingText
    title: str = Field(default="", max_length=2000)
    description: str = Field(default="", max_length=10000)
    simulate_registry_outage: bool = Field(default=False, description="Demo-only, request-scoped outage simulation. Forces UNKNOWN.")
    advertising_permit: Optional[str] = Field(default=None, max_length=200)
    registry_source: str = Field(default="synthetic", max_length=50)
    images: list[str] = Field(default_factory=list, max_length=5)
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    stock: Optional[Annotated[int, Field(strict=True, ge=0, le=10000000)]] = None

    @field_validator("images")
    @classmethod
    def valid_images(cls, value):
        return validate_images(value)


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
    listing: Optional[Listing] = None
    listing_title: str = ""
    claim_findings: list[ClaimFinding] = Field(default_factory=list)


def evaluate_rules(
    listing: Listing, trace: Trace, extraction_client=None, *, declarations: Optional[dict[str, str]] = None
):
    results = []

    def add(rule, result, reason_en, reason_th, evidence=None):
        results.append(dict(rule=rule, result=result, reason_en=reason_en, reason_th=reason_th, evidence=evidence))
        trace.add(rule, json.dumps(results[-1], sort_keys=True, ensure_ascii=False))

    status, reason, record = evaluate(listing, trace)
    add("R-01", "skip" if status == Status.UNKNOWN else "fail" if reason in {"evidence_requested", "registration_inactive"} else "pass",
        "Registration identity check", "ตรวจสอบข้อมูลทะเบียน")
    category_result = {
        "registration_identity_and_category_matched": "pass",
        "registration_category_mismatch": "fail",
    }.get(reason, "skip")
    text = listing.title + "\n" + listing.description
    registered_category = record.category.casefold() if record is not None else None
    category_claims = [phrase for phrase in RULES["category_claims"].get(registered_category, [])
                       if phrase.casefold() in text.casefold()]
    if category_claims:
        category_result = "fail"
        if status == Status.APPROVED:
            status, reason = Status.DENIED, "category_claim_mismatch"
    add("R-02", category_result, "Registered category check", "ตรวจสอบประเภทผลิตภัณฑ์",
        {"registered_category": registered_category, "category_claims": category_claims})
    if listing.title or listing.description:
        matches, missing = advertising_claims(listing.title, listing.description, listing.category.casefold())
        overclaims = find_overclaims(listing.title, listing.description)
        text = listing.title + "\n" + listing.description
        extracted = extract_claims(text, extraction_client)
        trace.add("claim_extraction", json.dumps(extracted, ensure_ascii=False, sort_keys=True))
        for claim in extracted:
            if claim["type"] == "disease_claim" and not any(item["phrase"] == claim["phrase"] for item in matches):
                start = text.index(claim["phrase"])
                matches.append({"phrase": claim["phrase"], "start": start, "end": start + len(claim["phrase"])})
        failed = bool(matches) or missing or bool(overclaims)
        add("R-03", "fail" if failed else "pass", "Advertising text check", "ตรวจสอบข้อความโฆษณา",
            dict(matches=matches, missing_required_term=missing, overclaims=[finding.model_dump() for finding in overclaims]))
        if failed and status == Status.APPROVED:
            status, reason = Status.DENIED, "advertising_overclaim" if overclaims else "advertising_claim_failed"
    else:
        add("R-03", "skip", "No advertising text submitted", "ไม่ได้ส่งข้อความโฆษณา")
    permit_problem = bool(record and (
        (record.permit_required and not listing.advertising_permit) or
        (listing.advertising_permit and (listing.advertising_permit != record.advertising_permit or not record.permit_active))
    ))
    if permit_problem:
        add("R-04", "fail", "Required permit missing, expired or conflicting", "ใบอนุญาตโฆษณาขาดหาย หมดอายุ หรือไม่ตรงกัน")
        if status == Status.APPROVED:
            status, reason = Status.PENDING, "permit_conflict"
    elif record is None or not listing.advertising_permit:
        add("R-04", "skip", "Permit comparison unavailable", "ไม่สามารถเปรียบเทียบใบอนุญาตโฆษณา")
    else:
        permit_conflict = listing.advertising_permit != record.advertising_permit
        add("R-04", "fail" if permit_conflict else "pass",
            "Permit differs from registry" if permit_conflict else "Permit matches synthetic registry",
            "ตรวจสอบใบอนุญาตโฆษณา")
        if permit_conflict and status == Status.APPROVED:
            status, reason = Status.PENDING, "permit_conflict"

    if declarations is None:
        add("R-05", "skip", "Seller evidence not submitted", "ยังไม่ได้ส่งหลักฐาน")
    elif record is None:
        add("R-05", "skip", "Registry record unavailable for evidence comparison", "ไม่มีข้อมูลทะเบียนสำหรับเปรียบเทียบหลักฐาน")
    else:
        matches = record.active and all(
            declarations[key].strip().casefold() == expected.strip().casefold()
            for key, expected in (
                ("product_name", record.product_name),
                ("license_holder", record.license_holder),
                ("registration_reference", listing.registration_reference),
            )
        )
        declared_standards = {
            " ".join(value.casefold().split())
            for value in declarations.get("standards", "").split(",") if value.strip()
        }
        standards_sufficient = not declared_standards or bool(declared_standards & {"iso 22000", "gmp"})
        evidence_passes = matches and standards_sufficient
        add("R-05", "pass" if evidence_passes else "fail",
            "Declared evidence fields match registry" if evidence_passes else "Evidence conflict requires human review",
            "ตรวจสอบข้อมูลหลักฐานกับทะเบียน", {
                "declarations_match": matches,
                "declared_standards": sorted(declared_standards),
                "standards_sufficient": standards_sufficient,
            })
        if not evidence_passes and status != Status.DENIED:
            status, reason = Status.PENDING, "evidence_conflict"
    return status, reason, results


def evaluate(listing: Listing, trace: Trace) -> Tuple[Status, str, Optional[registry.RegistryRecord]]:
    category = listing.category.casefold()
    if listing.simulate_registry_outage:
        trace.add("registry_lookup", "unavailable")
        return Status.UNKNOWN, "registry_unavailable", None
    if listing.registry_source != "synthetic" or listing.registration_reference.startswith("FOREIGN-"):
        trace.add("registry_source", "unsupported")
        return Status.UNKNOWN, "unsupported_registry", None
    reference = listing.registration_reference
    if not reference.startswith("DEMO-") and not re.fullmatch(r"\d{2}-\d-\d{5}-\d-\d{4}", reference):
        trace.add("registry_format", "unrecognized")
        return Status.UNKNOWN, "reference_format_unrecognized", None
    if category not in SUPPORTED_CATEGORIES:
        trace.add("category_mapping", "unmapped")
        return Status.UNKNOWN, "category_unmapped", None
    trace.add("category_mapping", "mapped")
    try:
        if listing.simulate_registry_outage:
            raise registry.RegistryUnavailable
        record = registry.tool_registry_lookup(listing.registration_reference)
    except registry.RegistryUnavailable:
        trace.add("registry_lookup", "unavailable")
        return Status.UNKNOWN, "registry_unavailable", None
    if record is None:
        trace.add("registry_lookup", "missing")
        return Status.UNKNOWN, "reference_missing", None
    trace.add("registry_lookup", "found")
    if record.category not in SUPPORTED_CATEGORIES:
        trace.add("registry_category_mapping", "unmapped")
        return Status.UNKNOWN, "registry_category_unmapped", None
    trace.add("registry_category_mapping", "mapped")

    if not record.active or record.registration_status in {"EXPIRED", "REVOKED"}:
        trace.add("registry_identity", "inactive")
        return Status.DENIED, "registration_inactive", record

    same_identity = (
        record.active
        and listing.product_name.casefold() == record.product_name.casefold()
        and listing.license_holder.casefold() == record.license_holder.casefold()
    )
    trace.add("registry_identity", "matched" if same_identity else "failed")
    if not same_identity:
        return Status.PENDING, "evidence_requested", record
    category_matches = category == record.category
    trace.add("registry_category", "matched" if category_matches else "failed")
    if not category_matches:
        return Status.DENIED, "registration_category_mismatch", record
    return Status.APPROVED, "registration_identity_and_category_matched", record
