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
from pydantic import BaseModel, StringConstraints
from typing_extensions import Annotated

from . import registry


ListingText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
SUPPORTED_CATEGORIES = {"supplement", "cosmetic"}


class Listing(BaseModel):
    registration_reference: ListingText
    product_name: ListingText
    license_holder: ListingText
    category: ListingText


class Status(str, Enum):
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    UNKNOWN = "UNKNOWN"


class TraceEntry(BaseModel):
    step: str
    outcome: str
    at: str
    previous_hash: Optional[str]
    chain_hash: str


class Trace:
    def __init__(self):
        self.entries = []

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


def evaluate(listing: Listing, trace: Trace) -> Tuple[Status, str]:
    category = listing.category.casefold()
    if category not in SUPPORTED_CATEGORIES:
        trace.add("category_mapping", "unmapped")
        return Status.UNKNOWN, "category_unmapped"
    trace.add("category_mapping", "mapped")
    try:
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

    same_identity = (
        record.active
        and listing.product_name.casefold() == record.product_name.casefold()
        and listing.license_holder.casefold() == record.license_holder.casefold()
    )
    trace.add("R-01", "matched" if same_identity else "failed")
    if not same_identity:
        return Status.DENIED, "registration_identity_failed"
    category_matches = category == record.category
    trace.add("R-02", "matched" if category_matches else "failed")
    if not category_matches:
        return Status.DENIED, "registration_category_mismatch"
    return Status.APPROVED, "registration_identity_and_category_matched"


def create_app(database: Path) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS verifications (id TEXT PRIMARY KEY, result TEXT NOT NULL)"
            )
        yield

    service = FastAPI(title="TrustCart Baseline Lead", version="0.1.0", lifespan=lifespan)

    @service.post("/v1/verifications", status_code=201, response_model=Verification)
    def submit(listing: Listing, response: Response) -> Verification:
        trace = Trace()
        status, reason = evaluate(listing, trace)
        confidence = 0.0 if status == Status.UNKNOWN else 1.0
        human_review_required = confidence < 0.75
        trace.add("decision", reason)
        trace.add("review_routing", "required" if human_review_required else "clear")
        result = Verification(
            id=uuid4(), status=status, reason=reason, confidence=confidence,
            human_review_required=human_review_required, trace=trace.entries,
            chain_hash=trace.entries[-1].chain_hash,
        )
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute(
                "INSERT INTO verifications (id, result) VALUES (?, ?)",
                (str(result.id), result.model_dump_json()),
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

    return service


app = create_app(Path("trustcart.sqlite3"))
