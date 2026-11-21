import sqlite3
from contextlib import asynccontextmanager, closing
from pathlib import Path

from fastapi import FastAPI

from .api import agency, reports, reviewer, seller, verifications
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


def create_app(database: Path) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            initialize_store(connection)
        yield

    service = FastAPI(title="TrustCart Baseline Lead", version="0.1.0", lifespan=lifespan)
    service.state.database = database
    service.state.extraction_client = openai_claim_client
    service.include_router(verifications.router)
    service.include_router(seller.router)
    service.include_router(reviewer.router)
    service.include_router(reports.router)
    service.include_router(agency.router)
    return service


app = create_app(Path("trustcart.sqlite3"))
