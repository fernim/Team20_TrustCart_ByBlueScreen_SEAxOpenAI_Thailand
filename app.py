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
        "TrustCart evaluates synthetic marketplace listings and returns a status, confidence, "
        "rule results, and a hash-chained audit trace. The shared HTTP Basic login grants "
        "access to all demo roles. Sign in as `demo` with the separately shared password.\n\n"
        "### Try the L1 evidence workflow\n\n"
        "1. Get the L1 listing from `GET /v1/demo/scenarios` and submit it to "
        "`POST /v1/verifications`. L1 returns `PENDING`. Use the returned ID or "
        "the `Location` header to retrieve the saved result.\n"
        "2. Upload the synthetic label and certificate with the declared identity fields to "
        "`POST /v1/verifications/{verification_id}/evidence`.\n"
        "3. Call `POST /v1/verifications/{verification_id}/recheck`, then submit the review "
        "decision and note to `POST /v1/verifications/{verification_id}/review`. Send the latest "
        "`chain_hash` with every action. If it is stale, reload the verification before retrying.\n"
        "4. Retrieve the report and audit from `GET /v1/reports/{verification_id}` and "
        "`GET /v1/audit/{verification_id}`.\n\n"
        "`GET /v1/demo/scenarios` returns all 40 synthetic listing fixtures. "
        "`GET /v1/agency/summary` aggregates saved synthetic decisions without seller identities.\n\n"
        "`GET /v1/demo/transactions?offline=true` shows how all 20 dashboard transactions "
        "route to `UNKNOWN` during a registry outage. Hosted SQLite is temporary, so a saved "
        "verification may be unavailable after a function restart or on another instance."
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
        """Return all 40 synthetic listing fixtures for scenarios L1–L40."""
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
