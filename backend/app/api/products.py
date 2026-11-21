import hashlib
import json
from .. import database as store
from contextlib import closing
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from ..verification import Listing, Status, Trace, Verification, evaluate_rules
from ..claims import find_overclaims
from ..workflow import RISK_POLICY_HASH, audit

router = APIRouter(tags=["Products"])


class ProductCreate(Listing):
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class ProductUpdate(ProductCreate):
    expected_version: int = Field(ge=1)


class Product(BaseModel):
    id: UUID
    version: int
    listing: Listing
    verification: Verification


def save_product(listing, product_id, request, expected_version=None):
    with closing(store.connect(request.app.state.database, timeout=20)) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute("SELECT version FROM products WHERE id=?", (str(product_id),)).fetchone()
        if expected_version is not None:
            if row is None:
                raise HTTPException(404, "Product not found")
            if row[0] != expected_version:
                raise HTTPException(409, "Product changed. Reload before editing.")
        version = row[0] + 1 if row else 1
        trace = Trace()
        trace.add("product_revision", json.dumps(dict(product_id=str(product_id), version=version), sort_keys=True))
        trace.add("listing_snapshot", hashlib.sha256(listing.model_dump_json().encode()).hexdigest())
        status, reason, rules = evaluate_rules(listing, trace, request.app.state.extraction_client)
        confidence = {Status.UNKNOWN: 0.0, Status.PENDING: 0.6}.get(status, 1.0)
        trace.add("risk_policy", RISK_POLICY_HASH)
        trace.add("decision", reason)
        trace.add("review_routing", "required" if confidence < 0.75 else "clear")
        verification = Verification(id=uuid4(), status=status, reason=reason, confidence=confidence,
            human_review_required=confidence < 0.75, trace=trace.entries, chain_hash=trace.entries[-1].chain_hash,
            rule_results=rules, listing=listing, listing_title=listing.title or listing.product_name,
            claim_findings=find_overclaims(listing.title, listing.description))
        product = Product(id=product_id, version=version, listing=listing, verification=verification)
        connection.execute("INSERT INTO verifications (id,result,listing) VALUES (?,?,?)",
            (str(verification.id), verification.model_dump_json(), listing.model_dump_json()))
        connection.execute("INSERT INTO products VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,result=excluded.result",
            (str(product_id), version, product.model_dump_json()))
    return product


def current_product(connection, raw):
    product = Product.model_validate_json(raw)
    row = connection.execute("SELECT result FROM verifications WHERE id=?", (str(product.verification.id),)).fetchone()
    if row:
        product.verification = Verification.model_validate_json(row[0])
        if not audit(json.loads(row[0]))["valid"]:
            product.verification.status = Status.UNKNOWN
            product.verification.confidence = 0
            product.verification.human_review_required = True
    return product


@router.post("/v1/products", status_code=201, response_model=Product)
def create_product(listing: ProductCreate, request: Request, response: Response):
    product = save_product(listing, uuid4(), request)
    response.headers["Location"] = "/v1/products/" + str(product.id)
    return product


@router.put("/v1/products/{product_id}", response_model=Product)
def update_product(product_id: UUID, update: ProductUpdate, request: Request):
    return save_product(Listing.model_validate(update.model_dump(exclude={"expected_version"})),
        product_id, request, update.expected_version)


@router.get("/v1/products", response_model=list[Product])
def list_products(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    with closing(store.connect(request.app.state.database)) as connection:
        return [current_product(connection, row[0]) for row in connection.execute("SELECT result FROM products ORDER BY rowid DESC").fetchall()]


@router.get("/v1/products/{product_id}", response_model=Product)
def get_product(product_id: UUID, request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    with closing(store.connect(request.app.state.database)) as connection:
        row = connection.execute("SELECT result FROM products WHERE id=?", (str(product_id),)).fetchone()
        if row is None:
            raise HTTPException(404, "Product not found")
        return current_product(connection, row[0])
