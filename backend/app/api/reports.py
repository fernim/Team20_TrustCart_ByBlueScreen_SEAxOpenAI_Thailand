import json
import sqlite3
from contextlib import closing
from uuid import UUID

from fastapi import APIRouter, Request

from ..workflow import Comparison, audit, load, risk


router = APIRouter()


@router.get("/v1/audit/{verification_id}", tags=["Reports"])
def audit_report(verification_id: UUID, request: Request):
    with closing(sqlite3.connect(request.app.state.database)) as connection:
        result, _ = load(connection, verification_id)
    return audit(result)


@router.get("/v1/reports/{verification_id}", tags=["Reports"])
def report(verification_id: UUID, request: Request):
    with closing(sqlite3.connect(request.app.state.database)) as connection:
        result, payload = load(connection, verification_id)
        evidence = [dict(zip(("kind", "sha256", "declarations"), row)) for row in connection.execute(
            "SELECT kind, sha256, declarations FROM evidence WHERE verification_id=?", (str(verification_id),))]
        for item in evidence:
            item["declarations"] = json.loads(item["declarations"])
    return dict(result, listing=payload, evidence=evidence, audit=audit(result), risk=risk(result), synthetic=True)


@router.get("/v1/widgets/{verification_id}", tags=["Reports"])
def widget(verification_id: UUID, request: Request):
    with closing(sqlite3.connect(request.app.state.database)) as connection:
        result, _ = load(connection, verification_id)
    status = result["status"] if audit(result)["valid"] else "UNKNOWN"
    labels = {"APPROVED": "ผ่านการตรวจสอบข้อมูลจำลอง", "PENDING": "รอการตรวจสอบ", "DENIED": "ไม่ผ่านการตรวจสอบ", "UNKNOWN": "ไม่สามารถตรวจสอบได้"}
    return dict(status=status, label_en=status.title(), label_th=labels[status],
        report_url="/v1/reports/" + str(verification_id), synthetic=True)


@router.post("/v1/products/compare", tags=["Reports"])
def compare(comparison: Comparison, request: Request):
    return {"products": [report(verification_id, request) for verification_id in comparison.ids], "synthetic": True}
