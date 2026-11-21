"""Shop-owned product workflow. Buyer representations never contain private evidence."""

import calendar
import json
import time
from contextlib import closing
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import Field
from .. import database as store
from ..connected_store import (
    transaction,
    read_product,
    read_submission,
    save_submission,
    now,
)
from ..security import require
from ..verification import Listing, Trace
from ..workflow import audit, continue_trace

router = APIRouter(tags=["Connected workflow"])


class SaleListing(Listing):
    registration_reference: str = Field(
        default="Not supplied", min_length=1, max_length=200
    )
    product_name: str = Field(default="Not supplied", min_length=1, max_length=200)
    license_holder: str = Field(default="Not supplied", min_length=1, max_length=200)
    category: str = Field(default="supplement", min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=2000)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class SaleEdit(SaleListing):
    expected_version: int = Field(ge=1)


def plan_state(connection, shop):
    row = connection.execute(
        "SELECT active_until FROM tc_plans WHERE id=?", (shop,)
    ).fetchone()
    expiry = row[0] if row else None
    return dict(
        active=bool(expiry and expiry > now()),
        active_until=expiry,
        price_thb=299,
        mode="demo",
        unlimited=True,
    )


def require_plan(connection, shop):
    if not plan_state(connection, shop)["active"]:
        raise HTTPException(403, "Activate the demo verification plan first")


def decorated(connection, product, owner, public=False):
    result = dict(product)
    submission = read_submission(connection, owner[1]) if owner[1] else None
    current = bool(submission and submission["product_version"] == product["version"])
    result["shop_id"] = owner[0]
    shop = connection.execute(
        "SELECT name FROM tc_shops WHERE id=?", (owner[0],)
    ).fetchone()
    result["shop_name"] = shop[0]
    result["workflow"] = dict(
        stage=submission["stage"] if current else "NOT_REQUESTED",
        submission_id=submission["id"] if current else None,
    )
    result["verification"] = submission if current else None
    result["badge_eligible"] = bool(
        current
        and submission["stage"] == "COMPLETED"
        and submission["status"] == "APPROVED"
        and submission["confidence"] >= 0.75
        and not submission["human_review_required"]
        and audit(submission)["valid"]
    )
    if public:
        result["listing"] = {
            key: value
            for key, value in result["listing"].items()
            if key
            in (
                "title",
                "description",
                "category",
                "images",
                "price",
                "stock",
                "product_name",
            )
        }
        result.pop("workflow", None)
        result["verification"] = {"status": submission["status"]} if current else None
    return result


@router.get("/v1/catalog/products")
def catalog(request: Request):
    with closing(store.connect(request.app.state.database)) as connection:
        ids = connection.execute("SELECT id FROM tc_owners ORDER BY id").fetchall()
        return [
            decorated(connection, *read_product(connection, row[0]), public=True)
            for row in ids
        ]


@router.get("/v1/seller/products")
def seller_products(request: Request):
    user = require(request, "seller")
    with closing(store.connect(request.app.state.database)) as connection:
        ids = connection.execute(
            "SELECT id FROM tc_owners WHERE shop_id=? ORDER BY id", (user["shop_id"],)
        ).fetchall()
        return [
            decorated(connection, *read_product(connection, row[0], user["shop_id"]))
            for row in ids
        ]


@router.get("/v1/seller/products/{product_id}")
def seller_product(product_id: UUID, request: Request):
    user = require(request, "seller")
    with closing(store.connect(request.app.state.database)) as connection:
        return decorated(
            connection, *read_product(connection, product_id, user["shop_id"])
        )


@router.post("/v1/seller/products", status_code=201)
def create_product(listing: SaleListing, request: Request):
    user = require(request, "seller")
    product = dict(
        id=str(uuid4()),
        version=1,
        marketplace="shopee",
        listing=listing.model_dump(mode="json"),
        verification=None,
    )
    with transaction(request.app.state.database) as connection:
        connection.execute(
            "INSERT INTO products (id,version,result) VALUES (?,?,?)",
            (product["id"], 1, json.dumps(product)),
        )
        connection.execute(
            "INSERT INTO tc_owners (id,shop_id) VALUES (?,?)",
            (product["id"], user["shop_id"]),
        )
        return decorated(connection, product, (user["shop_id"], None))


@router.put("/v1/seller/products/{product_id}")
def update_product(product_id: UUID, listing: SaleEdit, request: Request):
    user = require(request, "seller")
    with transaction(request.app.state.database) as connection:
        product, owner = read_product(connection, product_id, user["shop_id"])
        if product["version"] != listing.expected_version:
            raise HTTPException(409, "Product changed. Reload before editing.")
        if owner[1]:
            submission = read_submission(connection, owner[1])
            trace = continue_trace(submission)
            trace.add(
                "submission_superseded",
                json.dumps(
                    {"actor": user["id"], "product_version": product["version"] + 1}
                ),
            )
            submission.update(
                stage="SUPERSEDED",
                trace=[e.model_dump() for e in trace.entries],
                chain_hash=trace.entries[-1].chain_hash,
            )
            save_submission(connection, submission)
        product.update(
            version=product["version"] + 1,
            listing=listing.model_dump(mode="json", exclude={"expected_version"}),
            verification=None,
        )
        connection.execute(
            "UPDATE products SET version=?,result=? WHERE id=?",
            (product["version"], json.dumps(product), str(product_id)),
        )
        connection.execute(
            "UPDATE tc_owners SET active_submission=NULL WHERE id=?", (str(product_id),)
        )
        return decorated(connection, product, (owner[0], None))


@router.get("/v1/seller/subscription")
def subscription(request: Request):
    user = require(request, "seller")
    with closing(store.connect(request.app.state.database)) as connection:
        return plan_state(connection, user["shop_id"])


@router.post("/v1/seller/subscription/activate")
def activate(request: Request):
    user = require(request, "seller")
    today = datetime.now(timezone.utc)
    year = today.year + (today.month == 12)
    month = today.month % 12 + 1
    expiry = today.replace(
        year=year, month=month, day=min(today.day, calendar.monthrange(year, month)[1])
    ).isoformat()
    with transaction(request.app.state.database) as connection:
        state = plan_state(connection, user["shop_id"])
        if not state["active"]:
            connection.execute(
                "INSERT INTO tc_plans VALUES (?,?) ON CONFLICT(id) DO UPDATE SET active_until=excluded.active_until",
                (user["shop_id"], expiry),
            )
        return plan_state(connection, user["shop_id"])


@router.get("/v1/reviewer/submissions")
def reviewer_submissions(
    request: Request,
    shop_id: Optional[str] = None,
    status: Optional[str] = None,
    stage: Optional[str] = None,
    action_required: bool = False,
):
    require(request, "reviewer")
    with closing(store.connect(request.app.state.database)) as connection:
        owners = connection.execute(
            "SELECT id,shop_id,active_submission FROM tc_owners WHERE active_submission IS NOT NULL"
        ).fetchall()
        rows = []
        for product_id, shop, submission_id in owners:
            result = read_submission(connection, submission_id)
            if (
                shop_id
                and shop != shop_id
                or status
                and result["status"] != status
                or stage
                and result["stage"] != stage
            ):
                continue
            expired = (
                result["stage"] == "AI_CHECKING"
                and result.get("lease_until", 0) <= time.time()
            )
            result["lease_expired"] = expired
            if expired:
                result["human_review_required"] = True
            if (
                action_required
                and not expired
                and result["stage"] not in ("REVIEWER_REQUIRED", "UNAVAILABLE", "IN_REVIEW")
            ):
                continue
            result["shop_name"] = connection.execute(
                "SELECT name FROM tc_shops WHERE id=?", (shop,)
            ).fetchone()[0]
            rows.append(result)
        return sorted(
            rows, key=lambda r: (not r["human_review_required"], r["created_at"])
        )


@router.get("/v1/reviewer/shops")
def reviewer_shops(request: Request):
    require(request, "reviewer")
    with closing(store.connect(request.app.state.database)) as connection:
        return [
            dict(id=r[0], name=r[1])
            for r in connection.execute("SELECT id,name FROM tc_shops").fetchall()
        ]
