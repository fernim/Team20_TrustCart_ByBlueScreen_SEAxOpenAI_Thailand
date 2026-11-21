"""Agency work queues over current, shop-owned verification submissions."""

import json
from collections import Counter
from contextlib import closing
from typing import Literal, Optional
from fastapi import APIRouter, Query, Request
from .. import database as store
from ..security import require

router = APIRouter(tags=["Agency workspace"])
Marketplace = Literal["shopee", "lazada"]
WorkQueue = Literal[
    "all",
    "to_review",
    "in_progress",
    "waiting_documents",
    "seller_correction",
    "completed",
]
QUEUES = (
    "all",
    "to_review",
    "in_progress",
    "waiting_documents",
    "seller_correction",
    "completed",
)
STAGE_QUEUE = {
    "REVIEWER_REQUIRED": "to_review",
    "UNAVAILABLE": "to_review",
    "AI_CHECKING": "in_progress",
    "IN_REVIEW": "in_progress",
    "WAITING_DOCUMENTS": "waiting_documents",
    "SELLER_ACTION": "seller_correction",
    "COMPLETED": "completed",
}


@router.get("/v1/reviewer/queue")
def agency_queue(
    request: Request,
    marketplace: Optional[Marketplace] = None,
    work_queue: WorkQueue = "all",
    status: Optional[Literal["APPROVED", "PENDING", "DENIED", "UNKNOWN"]] = None,
    q: str = Query(default="", max_length=200),
):
    require(request, "reviewer")
    with closing(store.connect(request.app.state.database)) as connection:
        records = connection.execute("""SELECT p.result,s.result,h.name FROM tc_owners o
            JOIN products p ON p.id=o.id
            JOIN tc_submissions s ON s.id=o.active_submission
            JOIN tc_shops h ON h.id=o.shop_id""").fetchall()
    counts = Counter({key: 0 for key in QUEUES})
    items = []
    term = q.strip().casefold()
    for raw_product, raw_submission, shop_name in records:
        product, result = json.loads(raw_product), json.loads(raw_submission)
        if (
            result["product_version"] != product["version"]
            or result["stage"] == "SUPERSEDED"
        ):
            continue
        source = product.get("marketplace", "shopee")
        if (
            marketplace
            and marketplace != source
            or status
            and status != result["status"]
        ):
            continue
        listing = result["listing"]
        if term and not any(
            term in str(listing.get(key, "")).casefold()
            for key in ("title", "product_name", "registration_reference")
        ):
            continue
        queue = STAGE_QUEUE.get(result["stage"], "to_review")
        counts["all"] += 1
        counts[queue] += 1
        if work_queue != "all" and work_queue != queue:
            continue
        result.update(
            marketplace=source,
            shop_name=shop_name,
            work_queue=queue,
            updated_at=(
                result["trace"][-1]["at"]
                if result.get("trace")
                else result["created_at"]
            ),
        )
        items.append(result)
    items.sort(key=lambda item: (item["updated_at"], item["id"]), reverse=True)
    return dict(items=items, counts=dict(counts))
