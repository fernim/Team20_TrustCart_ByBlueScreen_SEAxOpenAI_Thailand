import hashlib
import json
import sqlite3
from contextlib import asynccontextmanager, closing
from datetime import datetime, timezone
from enum import Enum
from decimal import Decimal
from pathlib import Path
from typing import Optional, Tuple
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StringConstraints, field_validator
from typing_extensions import Annotated

from . import registry
from .claims import ClaimFinding, find_overclaims
from .media import validate_images


ListingText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
SUPPORTED_CATEGORIES = {"supplement", "cosmetic"}
FRONTEND = Path(__file__).resolve().parents[2] / "frontend"


class Listing(BaseModel):
    registration_reference: ListingText
    product_name: ListingText
    license_holder: ListingText
    category: ListingText
    title: Annotated[str, StringConstraints(max_length=1000)] = ""
    description: Annotated[str, StringConstraints(max_length=6000)] = ""
    images: list[str] = Field(default_factory=list, max_length=5)
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    stock: Optional[Annotated[int, Field(strict=True, ge=0, le=10000000)]] = None

    @field_validator("images")
    @classmethod
    def valid_images(cls, value):
        return validate_images(value)


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
    listing: Optional[Listing] = None
    listing_title: str = ""
    claim_findings: list[ClaimFinding] = Field(default_factory=list)


def evaluate(listing: Listing, trace: Trace) -> Tuple[Status, str, list[ClaimFinding]]:
    category = listing.category.casefold()
    if category not in SUPPORTED_CATEGORIES:
        trace.add("category_mapping", "unmapped")
        return Status.UNKNOWN, "category_unmapped", []
    trace.add("category_mapping", "mapped")
    try:
        record = registry.tool_registry_lookup(listing.registration_reference)
    except registry.RegistryUnavailable:
        trace.add("registry_lookup", "unavailable")
        return Status.UNKNOWN, "registry_unavailable", []
    if record is None:
        trace.add("registry_lookup", "missing")
        return Status.UNKNOWN, "reference_missing", []
    trace.add("registry_lookup", "found")
    if record.category not in SUPPORTED_CATEGORIES:
        trace.add("registry_category_mapping", "unmapped")
        return Status.UNKNOWN, "registry_category_unmapped", []
    trace.add("registry_category_mapping", "mapped")

    same_identity = (
        record.active
        and listing.product_name.casefold() == record.product_name.casefold()
        and listing.license_holder.casefold() == record.license_holder.casefold()
    )
    trace.add("R-01", "matched" if same_identity else "failed")
    category_matches = category == record.category
    trace.add("R-02", "matched" if category_matches else "failed")
    findings = find_overclaims(listing.title, listing.description)
    if findings:
        for finding in findings:
            trace.add("R-03", finding.model_dump_json())
        return Status.DENIED, "advertising_overclaim", findings
    trace.add("R-03", "passed")
    if not same_identity:
        return Status.DENIED, "registration_identity_failed", []
    if not category_matches:
        return Status.DENIED, "registration_category_mismatch", []
    return Status.APPROVED, "registration_identity_and_category_matched", []


class ProductCreate(Listing):
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class ProductUpdate(ProductCreate):
    expected_version: int = Field(ge=1)


class Product(BaseModel):
    id: UUID
    version: int
    listing: Listing
    verification: Verification


def build_verification(listing: Listing, product_id: Optional[str] = None, version: Optional[int] = None) -> Verification:
    trace = Trace()
    if product_id is not None:
        trace.add("product_revision", json.dumps({"product_id": product_id, "version": version}, sort_keys=True))
    trace.add("listing_snapshot", hashlib.sha256(listing.model_dump_json().encode("utf-8")).hexdigest())
    status, reason, findings = evaluate(listing, trace)
    confidence = 0.0 if status == Status.UNKNOWN else 1.0
    human_review_required = confidence < 0.75
    trace.add("decision", reason)
    trace.add("review_routing", "required" if human_review_required else "clear")
    result = Verification(
        id=uuid4(), status=status, reason=reason, confidence=confidence,
        human_review_required=human_review_required, trace=trace.entries,
        chain_hash=trace.entries[-1].chain_hash,
        listing=listing, listing_title=listing.title or listing.product_name, claim_findings=findings,
    )
    return result


def create_app(database: Path) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS verifications (id TEXT PRIMARY KEY, result TEXT NOT NULL)"
            )
            connection.execute("CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, version INTEGER NOT NULL, result TEXT NOT NULL)")
        yield

    service = FastAPI(title="TrustCart Baseline Lead", version="0.1.0", lifespan=lifespan)
    service.mount("/static", StaticFiles(directory=FRONTEND), name="static")

    @service.get("/", include_in_schema=False)
    def storefront() -> FileResponse:
        return FileResponse(FRONTEND / "index.html")

    @service.get("/products/{product_id}", include_in_schema=False)
    def product_page(product_id: str) -> FileResponse:
        return FileResponse(FRONTEND / "index.html")

    @service.get("/seller", include_in_schema=False)
    def seller() -> FileResponse:
        return FileResponse(FRONTEND / "seller.html")

    @service.get("/reviewer", include_in_schema=False)
    def reviewer() -> FileResponse:
        return FileResponse(FRONTEND / "reviewer.html")

    @service.post("/v1/verifications", status_code=201, response_model=Verification)
    def submit(listing: Listing, response: Response) -> Verification:
        result = build_verification(listing)
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute(
                "INSERT INTO verifications (id, result) VALUES (?, ?)",
                (str(result.id), result.model_dump_json()),
            )
        response.headers["Location"] = f"/v1/verifications/{result.id}"
        return result

    def save_product(listing: Listing, product_id: UUID, expected_version: Optional[int] = None) -> Product:
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT version FROM products WHERE id = ?", (str(product_id),)).fetchone()
            if expected_version is not None:
                if row is None:
                    raise HTTPException(status_code=404, detail="Product not found")
                if row[0] != expected_version:
                    raise HTTPException(status_code=409, detail="Product changed. Reload before editing.")
            version = row[0] + 1 if row else 1
            result = build_verification(listing, str(product_id), version)
            product = Product(id=product_id, version=version, listing=listing, verification=result)
            connection.execute("INSERT INTO verifications (id, result) VALUES (?, ?)", (str(result.id), result.model_dump_json()))
            connection.execute("INSERT INTO products (id, version, result) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET version=excluded.version, result=excluded.result", (str(product_id), version, product.model_dump_json()))
        return product

    @service.post("/v1/products", status_code=201, response_model=Product)
    def create_product(listing: ProductCreate, response: Response) -> Product:
        product = save_product(listing, uuid4())
        response.headers["Location"] = f"/v1/products/{product.id}"
        return product

    @service.put("/v1/products/{product_id}", response_model=Product)
    def update_product(product_id: UUID, update: ProductUpdate) -> Product:
        listing = Listing.model_validate(update.model_dump(exclude={"expected_version"}))
        return save_product(listing, product_id, update.expected_version)

    @service.get("/v1/products", response_model=list[Product])
    def list_products(response: Response) -> list[Product]:
        response.headers["Cache-Control"] = "no-store"
        with closing(sqlite3.connect(database)) as connection:
            rows = connection.execute("SELECT result FROM products ORDER BY rowid DESC").fetchall()
        return [Product.model_validate_json(row[0]) for row in rows]

    @service.get("/v1/products/{product_id}", response_model=Product)
    def get_product(product_id: UUID, response: Response) -> Product:
        response.headers["Cache-Control"] = "no-store"
        with closing(sqlite3.connect(database)) as connection:
            row = connection.execute("SELECT result FROM products WHERE id = ?", (str(product_id),)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        return Product.model_validate_json(row[0])

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
