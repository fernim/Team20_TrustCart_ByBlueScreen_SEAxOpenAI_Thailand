import base64
import binascii
import os
import tempfile
from hmac import compare_digest
from pathlib import Path

from fastapi import Request
from fastapi.responses import HTMLResponse, PlainTextResponse

from backend.app.main import Listing, Trace, create_app, evaluate_rules, Status
from backend.app.registry import demo_listings


PRODUCTS = (
    "Turmeric Blend", "Daily Fibre", "Firming Serum", "Botanical Blend",
    "Green Blend", "Oat Fibre", "Ocean Wellness", "Citrus Blend", "Rice Bran",
    "Cocoa Fibre", "Herbal Blend", "Aloe Gel", "Ginger Blend", "Plant Fibre",
    "Oat Cream", "Berry Blend", "Daily Moisturiser", "Lemongrass Blend",
    "Pumpkin Fibre", "Rice Cleanser",
)
DEMO_EXAMPLE = {
    "registration_reference": "DEMO-001",
    "product_name": "Demo Supplement",
    "license_holder": "Demo Brand",
    "category": "supplement",
}


def demo_transactions(offline=False):
    records = []
    cases = list(demo_listings().items())
    for number, product in enumerate(PRODUCTS, start=1):
        case_id, payload = cases[(number - 1) % len(cases)]
        listing = Listing(**payload)
        listing.simulate_registry_outage = offline
        trace = Trace()
        trace.add("demo_fixture", f"TX-{number:03}")
        status, reason, rule_results = evaluate_rules(listing, trace)
        confidence = {Status.UNKNOWN: 0.0, Status.PENDING: 0.60}.get(status, 1.0)
        trace.add("decision", reason)
        trace.add("review_routing", "required" if confidence < 0.75 else "clear")
        records.append({
            "id": f"TX-{number:03}", "scenario": case_id,
            "listing": listing.product_name, "seller": f"Demo Store {(number - 1) % 5 + 1}",
            "amount_thb": 190 + number * 15, "status": status.value,
            "reason": reason, "confidence": confidence,
            "human_review_required": confidence < 0.75,
            "rule_results": rule_results,
            "trace": [entry.model_dump() for entry in trace.entries],
            "chain_hash": trace.entries[-1].chain_hash,
            "synthetic": True,
        })
    return records


def create_demo_app(database: Path):
    service = create_app(database)
    service.title = "TrustCart Marketplace API"
    service.description = (
        "Password-protected synthetic marketplace demo. Use GET /v1/demo/transactions "
        "to explore the 20 rule-evaluated synthetic scenarios. The working verification endpoint "
        "checks synthetic registration identity and category and returns a "
        "Location header for retrieving the decision. Demo scenarios for R-03 "
        "through R-05 include deterministic claim screening, declared permit conflicts, and pending evidence work. "
        "Sign in with username demo and the shared demo password. "
        "Use Try it out on POST /v1/verifications with the example body, "
        "then copy the returned id into GET /v1/verifications/{verification_id}. "
        "Responses include a status, confidence, human_review_required and a "
        "hash-chained trace. HTTP 401 means authentication is required, "
        "404 means the result was not found and 422 means the request is invalid. "
        "Hosted SQLite storage is temporary and a result may be unavailable "
        "after a function restart or on another instance."
    )
    ListingSchema = service.openapi

    def demo_openapi():
        schema = ListingSchema()
        schema["components"]["schemas"]["Listing"]["example"] = DEMO_EXAMPLE
        schema["components"]["securitySchemes"] = {
            "DemoPassword": {"type": "http", "scheme": "basic"}
        }
        schema["security"] = [{"DemoPassword": []}]
        return schema

    service.openapi = demo_openapi
    dashboard = Path(__file__).with_name("demo.html").read_text(encoding="utf-8")

    @service.middleware("http")
    async def password_gate(request: Request, call_next):
        password = os.environ.get("TRUSTCART_DEMO_PASSWORD")
        if not password:
            return PlainTextResponse("Demo access is unavailable", 503, headers={"Cache-Control": "no-store"})
        scheme, _, encoded = request.headers.get("authorization", "").partition(" ")
        supplied = b""
        if scheme.lower() == "basic":
            try:
                supplied = base64.b64decode(encoded, validate=True)
            except (ValueError, binascii.Error):
                pass
        if not compare_digest(supplied, f"demo:{password}".encode()):
            return PlainTextResponse("Authentication required", 401, headers={
                "WWW-Authenticate": 'Basic realm="TrustCart Demo", charset="UTF-8"',
                "Cache-Control": "no-store",
            })
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @service.get("/", response_class=HTMLResponse, include_in_schema=False)
    def home():
        return dashboard

    @service.get("/v1/demo/transactions", tags=["Demo"])
    def transactions(offline: bool = False):
        """List the 20 synthetic marketplace transaction scenarios and audit traces."""
        return demo_transactions(offline)

    @service.get("/v1/demo/example", tags=["Demo"])
    def example():
        """Return a sample body for POST /v1/verifications."""
        return DEMO_EXAMPLE

    return service


app = create_demo_app(Path(tempfile.gettempdir()) / "trustcart-demo.sqlite3")
