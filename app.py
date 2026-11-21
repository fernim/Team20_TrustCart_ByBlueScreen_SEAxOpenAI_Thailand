import base64
import binascii
import os
import tempfile
import json
import sqlite3
from contextlib import closing
from hmac import compare_digest
from pathlib import Path

from fastapi import Request, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse

from backend.app.main import Listing, Trace, create_app, evaluate_rules, Status
from backend.app.registry import demo_listings
from backend.app.workflow import Revision, audit
from uuid import UUID


DEMO_EXAMPLE = {
    "registration_reference": "DEMO-001",
    "product_name": "Demo Supplement",
    "license_holder": "Demo Brand",
    "category": "supplement",
}


def demo_transactions(offline=False):
    records = []
    cases = list(demo_listings().items())
    for number in range(1, 21):
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
        "through R-05 include phrase-based claim screening, registry permit comparison, and seller evidence checks. "
        "Upload synthetic evidence, recheck, and send a reviewer decision with the latest chain_hash. "
        "Use /v1/reports, /v1/widgets and /v1/audit for shopper results. Stale hashes and failed audit checks return 409. "
        "The shared demo login grants access to all three demonstration roles. "
        "Sign in with username demo and the shared demo password. "
        "Use Try it out on POST /v1/verifications with the example body, "
        "then copy the returned id into GET /v1/verifications/{verification_id}. "
        "Responses include a status, confidence, human_review_required and a "
        "hash-chained trace. HTTP 401 means authentication is required, "
        "404 means the result was not found and 422 means the request is invalid. "
        "Hosted SQLite storage is temporary and a result may be unavailable "
        "after a function restart or on another instance."
    )
    original_openapi = service.openapi

    def demo_openapi():
        schema = original_openapi()
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

    @service.get("/v1/demo/scenarios", tags=["Demo"])
    def scenarios():
        return demo_listings()

    @service.post("/demo/tamper/{verification_id}", tags=["Demo"])
    def tamper(verification_id: UUID, revision: Revision):
        """Intentionally corrupt a synthetic trace to demonstrate audit detection."""
        with closing(sqlite3.connect(database, timeout=20)) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT result FROM verifications WHERE id=?", (str(verification_id),)).fetchone()
            if row is None:
                raise HTTPException(404, "Verification not found")
            result = json.loads(row[0])
            if revision.chain_hash != result["chain_hash"] or not audit(result)["valid"]:
                raise HTTPException(409, "Reload a valid report before tampering")
            result["trace"][0]["outcome"] = "Intentional synthetic tamper demonstration"
            connection.execute("UPDATE verifications SET result=? WHERE id=?", (json.dumps(result), str(verification_id)))
        return audit(result)

    return service


app = create_demo_app(Path(tempfile.gettempdir()) / "trustcart-demo.sqlite3")
