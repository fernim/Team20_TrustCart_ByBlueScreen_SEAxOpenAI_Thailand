"""Known synthetic documents for explicitly labeled replay, never a live fallback."""

import base64
import hashlib
import json
from pathlib import Path
from .registry import demo_listings
from .verification import Listing


def pdf_document(lines):
    # A small, deterministic, one-page text PDF. No external documents are imported.
    escaped = [
        line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        for line in lines
    ]
    stream = (
        "BT /F1 12 Tf 50 750 Td "
        + " 0 -24 Td ".join("(" + line + ") Tj" for line in escaped)
        + " ET"
    ).encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length "
        + str(len(stream)).encode()
        + b" >>\nstream\n"
        + stream
        + b"\nendstream",
    ]
    result = b"%PDF-1.4\n"
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result += str(i).encode() + b" 0 obj\n" + obj + b"\nendobj\n"
    xref = len(result)
    result += b"xref\n0 6\n0000000000 65535 f \n" + b"".join(
        f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:]
    )
    return (
        result + f"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    )


def cases():
    fixture = demo_listings()["L2"]
    image = Path(__file__).resolve().parents[2] / "frontend/assets/demo-supplement.png"
    base = Listing(
        **{
            **fixture,
            "title": fixture["product_name"],
            "price": "199.00",
            "stock": 20,
            "images": [
                "data:image/png;base64," + base64.b64encode(image.read_bytes()).decode()
            ],
        }
    ).model_dump(mode="json")
    return {
        "clean": {"name": "Matching supplement / ข้อมูลตรงกัน", "listing": base},
        "uncertain": {
            "name": "Unclear document / ต้องให้เจ้าหน้าที่ตรวจ",
            "listing": {**base, "title": base["title"] + " - unclear label"},
        },
        "overclaim": {
            "name": "Prohibited claim / คำกล่าวอ้างเกินจริง",
            "listing": {**base, "title": base["title"] + " - prevents obesity"},
        },
    }


def document(case, kind):
    listing = cases()[case]["listing"]
    holder = listing["license_holder"]
    if case == "uncertain" and kind == "label":
        holder = "Unclear - reviewer must inspect"
    return pdf_document(
        [
            "SYNTHETIC DEMO DOCUMENT",
            kind.upper(),
            listing["product_name"],
            holder,
            listing["registration_reference"],
            listing.get("advertising_permit") or "No advertising permit",
            "Not an official certificate",
        ]
    )


def replay(listing, documents):
    normalized = Listing(**listing).model_dump(mode="json")
    for case, fixture in cases().items():
        if normalized != fixture["listing"]:
            continue
        if len(documents) != 3 or {d["kind"] for d in documents} != {
            "label",
            "certificate",
            "permit",
        }:
            continue
        if any(
            d["digest"] != hashlib.sha256(document(case, d["kind"])).hexdigest()
            for d in documents
        ):
            continue
        fields = {
            key: listing[key]
            for key in ("product_name", "license_holder", "registration_reference")
        }
        return dict(
            confidence=0.6 if case == "uncertain" else 0.95,
            missing=[],
            inconsistencies=[],
            documents=[
                dict(
                    document_id=d["id"],
                    readable=case != "uncertain" or d["kind"] != "label",
                    fields=fields,
                    advertising_permit=(
                        listing["advertising_permit"] if d["kind"] == "permit" else None
                    ),
                    quotes=[
                        dict(field=key, quote=value, page=1)
                        for key, value in fields.items()
                    ]
                    + (
                        [
                            dict(
                                field="advertising_permit",
                                quote=listing["advertising_permit"],
                                page=1,
                            )
                        ]
                        if d["kind"] == "permit"
                        else []
                    ),
                    uncertainties=(
                        ["Licence holder is unclear"]
                        if case == "uncertain" and d["kind"] == "label"
                        else []
                    ),
                )
                for d in documents
            ],
        )
    raise ValueError(
        "Replay is only available for unchanged demo listings and matching fixture documents"
    )
