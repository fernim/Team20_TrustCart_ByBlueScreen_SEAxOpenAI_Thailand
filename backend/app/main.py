from . import database as store
import mimetypes
from contextlib import asynccontextmanager, closing
from pathlib import Path

from fastapi import FastAPI, Request
from uuid import UUID

from .api import agency, products, reports, reviewer, seller, verifications
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from .llm import openai_claim_client
from .verification import (
    Listing as Listing,
    Status as Status,
    Trace as Trace,
    TraceEntry as TraceEntry,
    Verification as Verification,
    evaluate as evaluate,
    evaluate_rules as evaluate_rules,
)
from .workflow import initialize_store
from . import security, connected_store
from .api import connected, submissions, documents, assessment, agency_queue


def create_app(database: Path) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        with closing(store.connect(database)) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            initialize_store(connection)
            connection.execute(
                "CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, version INTEGER NOT NULL, result TEXT NOT NULL)"
            )
            connected_store.initialize(connection)
        yield

    service = FastAPI(
        title="TrustCart Baseline Lead", version="0.1.0", lifespan=lifespan
    )
    service.middleware("http")(security.access_guard)
    service.include_router(security.router)
    service.include_router(connected.router)
    service.include_router(agency_queue.router)
    service.include_router(submissions.router)
    service.include_router(documents.router)
    service.include_router(assessment.router)
    service.state.database = database
    service.state.extraction_client = openai_claim_client
    service.include_router(verifications.router)
    service.include_router(seller.router)
    service.include_router(reviewer.router)
    service.include_router(reports.router)
    service.include_router(agency.router)
    service.include_router(products.router)
    frontend = Path(__file__).resolve().parents[2] / "frontend"
    mimetypes.add_type("image/webp", ".webp")
    service.mount("/static", StaticFiles(directory=frontend), name="static")

    @service.get("/", include_in_schema=False)
    def storefront():
        return FileResponse(frontend / "index.html")

    @service.get("/products/{product_id}", include_in_schema=False)
    def product_page(product_id: str):
        return FileResponse(frontend / "index.html")

    @service.get("/login", include_in_schema=False)
    def login_page():
        return FileResponse(frontend / "login.html")

    @service.get("/seller", include_in_schema=False)
    def seller_page():
        return FileResponse(frontend / "seller.html")

    @service.get("/agency", include_in_schema=False)
    def agency_page():
        return FileResponse(frontend / "agency.html")

    @service.get("/agency/submissions/{submission_id}", include_in_schema=False)
    def agency_report_page(submission_id: UUID):
        return FileResponse(frontend / "agency-report.html")

    @service.get("/reviewer", include_in_schema=False)
    def reviewer_page(request: Request):
        try:
            submission_id = UUID(request.query_params.get("id", ""))
        except ValueError:
            return RedirectResponse("/agency", status_code=303)
        return RedirectResponse(
            "/agency/submissions/" + str(submission_id), status_code=303
        )

    return service


app = create_app(Path("trustcart.sqlite3"))
