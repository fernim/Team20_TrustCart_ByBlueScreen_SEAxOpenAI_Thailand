import base64
import binascii
import os
import tempfile
from hmac import compare_digest
from pathlib import Path

from fastapi import Request
from fastapi.responses import HTMLResponse, PlainTextResponse

from backend.app.main import Trace, create_app


PRODUCTS = (
    "Turmeric Blend", "Daily Fibre", "Firming Serum", "Botanical Blend",
    "Green Blend", "Oat Fibre", "Ocean Wellness", "Citrus Blend", "Rice Bran",
    "Cocoa Fibre", "Herbal Blend", "Aloe Gel", "Ginger Blend", "Plant Fibre",
    "Oat Cream", "Berry Blend", "Daily Moisturiser", "Lemongrass Blend",
    "Pumpkin Fibre", "Rice Cleanser",
)
SCENARIOS = (
    ("PENDING", "Seller evidence requested", "R-05", 0.60),
    ("APPROVED", "Registry identity and category matched", "R-01 / R-02", 1.0),
    ("DENIED", "Registration fixture marked inactive", "R-01", 1.0),
    ("DENIED", "Advertising copy flagged in the demo", "R-03", 1.0),
    ("UNKNOWN", "Registration reference unavailable", "R-01", 0.0),
    ("APPROVED", "Registry identity and category matched", "R-01 / R-02", 1.0),
    ("PENDING", "Advertising permit conflict", "R-04", 0.60),
    ("UNKNOWN", "Registry outage simulated", "registry_lookup", 0.0),
)
DEMO_EXAMPLE = {
    "registration_reference": "DEMO-001",
    "product_name": "Demo Supplement",
    "license_holder": "Demo Brand",
    "category": "supplement",
}


def demo_transactions():
    records = []
    for number, product in enumerate(PRODUCTS, start=1):
        status, reason, rule, confidence = SCENARIOS[(number - 1) % len(SCENARIOS)]
        trace = Trace()
        trace.add("demo_fixture", f"TX-{number:03}")
        trace.add(rule, reason)
        trace.add("decision", status)
        trace.add("review_routing", "required" if confidence < 0.75 else "clear")
        records.append({
            "id": f"TX-{number:03}",
            "listing": product,
            "seller": f"Demo Store {(number - 1) % 5 + 1}",
            "amount_thb": 190 + number * 15,
            "status": status,
            "reason": reason,
            "rule": rule,
            "confidence": confidence,
            "human_review_required": confidence < 0.75,
            "trace": [entry.model_dump() for entry in trace.entries],
            "chain_hash": trace.entries[-1].chain_hash,
        })
    return records


def create_demo_app(database: Path):
    service = create_app(database)
    service.title = "TrustCart Marketplace API"
    service.description = (
        "Password-protected synthetic marketplace demo. Use GET /v1/demo/transactions "
        "to explore the 20 simulated scenarios. The working verification endpoint "
        "checks synthetic registration identity and category and returns a "
        "Location header for retrieving the decision. Demo scenarios for R-03 "
        "through R-05 illustrate the product workflow. "
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
    records = demo_transactions()
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
    def transactions():
        """List the 20 synthetic marketplace transaction scenarios and audit traces."""
        return records

    @service.get("/v1/demo/example", tags=["Demo"])
    def example():
        """Return a sample body for POST /v1/verifications."""
        return DEMO_EXAMPLE

    return service


app = create_demo_app(Path(tempfile.gettempdir()) / "trustcart-demo.sqlite3")
