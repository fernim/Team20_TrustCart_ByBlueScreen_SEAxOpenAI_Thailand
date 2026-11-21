import base64
import binascii
import os
import tempfile
from contextlib import closing
from hmac import compare_digest
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, Request
from fastapi.responses import HTMLResponse, PlainTextResponse

from backend.app import database as store
from backend.app.demo_access import allows_browser_write
from backend.app.main import Listing, Status, Trace, create_app, evaluate_rules
from backend.app.marketplace_auth import TOKEN_PATH
from backend.app.registry import demo_listings
from backend.app.workflow import Revision, audit, load


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
        "rule results, and a hash-chained audit trace. Sign in as `demo` with the separately shared "
        "HTTP Basic password. On deployments with reviewer access configured separately, sign in as "
        "`reviewer` for the queue, review decisions, and agency summary.\n\n"
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
        schemas = schema["components"]["schemas"]
        listing_schema = schemas.get("Listing", schemas.get("Listing-Input"))
        listing_schema["example"] = DEMO_EXAMPLE
        schemas.setdefault("Listing", listing_schema)
        schema["components"].setdefault("securitySchemes", {})["DemoPassword"] = {"type": "http", "scheme": "basic"}
        schema["security"] = [{"DemoPassword": []}]
        return schema

    service.openapi = demo_openapi
    dashboard = Path(__file__).with_name("demo.html").read_text(encoding="utf-8")

    @service.get("/version", openapi_extra={"security": []})
    def version():
        return {"commit": os.environ.get("VERCEL_GIT_COMMIT_SHA") or "local"}

    @service.middleware("http")
    async def password_gate(request: Request, call_next):
        # The connected storefront uses role sessions. Retain Basic only for legacy tools.
        path = request.url.path
        if request.method == "GET" and path == "/version":
            return await call_next(request)
        if request.method == "POST" and path == TOKEN_PATH:
            return await call_next(request)
        if request.cookies.get("trustcart_session") or path in ("/", "/login", "/seller", "/reviewer", "/agency") or path.startswith(("/agency/", "/static/", "/products/", "/v1/auth/", "/v1/catalog/", "/v1/seller/", "/v1/reviewer/", "/v1/documents/")):
            return await call_next(request)
        password = os.environ.get("TRUSTCART_DEMO_PASSWORD")
        if not password:
            return PlainTextResponse("Demo access is unavailable", 503, headers={"Cache-Control": "no-store"})
        reviewer_password = os.environ.get("TRUSTCART_REVIEWER_PASSWORD")
        scheme, _, encoded = request.headers.get("authorization", "").partition(" ")
        supplied = b""
        if scheme.lower() == "basic":
            try:
                supplied = base64.b64decode(encoded, validate=True)
            except (ValueError, binascii.Error):
                pass
        reviewer_authenticated = (
            bool(reviewer_password)
            and not compare_digest(reviewer_password.encode(), password.encode())
            and compare_digest(supplied, f"reviewer:{reviewer_password}".encode())
        )
        if not (compare_digest(supplied, f"demo:{password}".encode()) or reviewer_authenticated):
            return PlainTextResponse("Authentication required", 401, headers={
                "WWW-Authenticate": 'Basic realm="TrustCart Demo", charset="UTF-8"',
                "Cache-Control": "no-store",
            })
        if not allows_browser_write(request):
            return PlainTextResponse(
                "Cross-origin writes are unavailable in the demo", 403,
                headers={"Cache-Control": "no-store"},
            )
        request.state.demo_reviewer_access = not reviewer_password or reviewer_authenticated
        if reviewer_authenticated:
            request.state.reviewer_actor = "reviewer"
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @service.get("/workspace", response_class=HTMLResponse, include_in_schema=False)
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

    @service.post("/demo/tamper/{verification_id}", tags=["Demo"], summary="Simulate audit tampering")
    def tamper(verification_id: UUID, revision: Revision):
        """Simulate tampering on a copy of the saved trace and return its audit result."""
        with closing(store.connect(database)) as connection:
            result, _ = load(connection, verification_id)
        if revision.chain_hash != result["chain_hash"] or not result["trace"] or not audit(result)["valid"]:
            raise HTTPException(409, "Reload a valid report before simulating tampering")
        result["trace"][0]["outcome"] = "Intentional synthetic tamper demonstration"
        return audit(result)

    return service


app = create_demo_app(Path(tempfile.gettempdir()) / "trustcart-demo.sqlite3")
