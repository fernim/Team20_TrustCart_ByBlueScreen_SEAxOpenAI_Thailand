import hashlib
import io
import warnings
from contextlib import closing
from uuid import UUID, uuid4
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from PIL import Image
from pypdf import PdfReader
from .. import database as store
from ..connected_store import transaction, now, save_submission
from ..security import require
from ..demo_cases import cases, document
from .connected import require_plan
from .submissions import active_submission, check_revision, event

router = APIRouter(tags=["Private documents"])
LIMIT = 2 * 1024 * 1024


def validate_file(raw, mime):
    if not raw or len(raw) > LIMIT:
        raise HTTPException(413, "Use nonempty files up to 2 MiB")
    try:
        if mime == "application/pdf":
            if not raw.startswith(b"%PDF-"):
                raise ValueError()
            reader = PdfReader(io.BytesIO(raw), strict=True)
            if reader.is_encrypted or not 1 <= len(reader.pages) <= 10:
                raise ValueError()
            return
        formats = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as image:
                if (
                    mime not in formats
                    or image.format != formats[mime]
                    or image.width * image.height > 16000000
                ):
                    raise ValueError()
                image.verify()
    except Exception:
        raise HTTPException(
            422, "Use a readable, unencrypted PDF (1–10 pages), PNG, JPEG or WebP"
        )


@router.post("/v1/seller/submissions/{submission_id}/documents")
async def upload(
    submission_id: UUID,
    request: Request,
    kind: str = Form(...),
    chain_hash: str = Form(...),
    file: UploadFile = File(...),
):
    user = require(request, "seller")
    if kind not in ("label", "certificate", "permit", "supporting"):
        raise HTTPException(422, "Unknown document type")
    raw = await file.read(LIMIT + 1)
    validate_file(raw, file.content_type)
    filename = (file.filename or "document").replace("\\", "/").split("/")[-1][:100]
    with transaction(request.app.state.database) as connection:
        result, _ = active_submission(connection, submission_id, user["shop_id"])
        require_plan(connection, user["shop_id"])
        check_revision(result, chain_hash)
        if result["stage"] != "WAITING_DOCUMENTS":
            raise HTTPException(
                409, "Create a new submission before replacing checked evidence"
            )
        retained = [
            d for d in result["documents"] if d["kind"] != kind or kind == "supporting"
        ]
        if len(retained) >= 5:
            raise HTTPException(422, "Maximum five documents per submission")
        doc = dict(
            id=str(uuid4()),
            kind=kind,
            filename=filename,
            mime=file.content_type,
            digest=hashlib.sha256(raw).hexdigest(),
        )
        connection.execute(
            "INSERT INTO tc_documents VALUES (?,?,?,?,?,?,?,?,?)",
            (
                doc["id"],
                result["product_id"],
                user["shop_id"],
                kind,
                filename,
                file.content_type,
                doc["digest"],
                raw,
                now(),
            ),
        )
        result["documents"] = retained + [doc]
        event(
            result,
            "document_uploaded",
            {"actor": user["id"], "document": doc, "chain_hash": chain_hash},
        )
        save_submission(connection, result)
        return result


@router.get("/v1/documents/{document_id}")
def retrieve(document_id: UUID, request: Request):
    user = require(request)
    if user["role"] not in ("seller", "reviewer"):
        raise HTTPException(403, "Private documents are restricted")
    with closing(store.connect(request.app.state.database)) as connection:
        row = connection.execute(
            "SELECT shop_id,mime,content FROM tc_documents WHERE id=?",
            (str(document_id),),
        ).fetchone()
        if not row or user["role"] == "seller" and row[0] != user["shop_id"]:
            raise HTTPException(404, "Document not found")
        return Response(
            bytes(row[2]),
            media_type=row[1],
            headers={
                "Cache-Control": "no-store",
                "Content-Disposition": "inline",
                "Content-Security-Policy": "sandbox; default-src 'none'",
            },
        )


@router.get("/v1/seller/demo-cases")
def demo_cases(request: Request):
    require(request, "seller")
    return cases()


@router.get("/v1/seller/demo-cases/{case}/{kind}")
def fixture_document(case: str, kind: str, request: Request):
    require(request, "seller")
    if case not in cases() or kind not in ("label", "certificate", "permit"):
        raise HTTPException(404, "Demo document not found")
    return Response(
        document(case, kind),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{case}-{kind}.pdf"',
            "Cache-Control": "no-store",
        },
    )
