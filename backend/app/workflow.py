import hashlib
import json
import sqlite3
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4
from pathlib import Path

from fastapi import File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from . import registry


_POLICY_BYTES = (Path(__file__).resolve().parent.parent / "data" / "risk_policy.json").read_bytes()
RISK_POLICY = json.loads(_POLICY_BYTES)
RISK_POLICY_HASH = hashlib.sha256(_POLICY_BYTES).hexdigest()


class Revision(BaseModel):
    chain_hash: str = Field(min_length=64, max_length=64)


class Review(Revision):
    decision: Literal["approve", "deny"]
    note: str = Field(min_length=1, max_length=1000)


class Comparison(BaseModel):
    ids: list[UUID] = Field(min_length=1, max_length=10)


def audit(result):
    previous = None
    for index, entry in enumerate(result["trace"]):
        event = {key: value for key, value in entry.items() if key != "chain_hash"}
        digest = hashlib.sha256(json.dumps(event, sort_keys=True).encode("utf-8")).hexdigest()
        if entry["previous_hash"] != previous or entry["chain_hash"] != digest:
            return {"valid": False, "broken_at": index}
        previous = digest
    return {"valid": previous == result["chain_hash"], "broken_at": None if previous == result["chain_hash"] else len(result["trace"])}


def risk(result):
    factors = []
    if result["status"] == "UNKNOWN":
        factors.append({"reason": "Verification unavailable", "points": RISK_POLICY["unavailable"]})
    for rule in result.get("rule_results", []):
        if rule["result"] == "fail":
            factors.append({"reason": rule["rule"], "points": RISK_POLICY["failed_rules"].get(rule["rule"], 10)})
    score = sum(item["points"] for item in factors)
    return {"version": RISK_POLICY["version"], "policy_hash": RISK_POLICY_HASH, "score": score,
        "tier": "high" if score >= RISK_POLICY["high"] else "medium" if score >= RISK_POLICY["medium"] else "low",
        "factors": factors, "calibration": RISK_POLICY["calibration"]}


def install_workflow(service, database):
    from .main import Listing, Status, Trace, TraceEntry, evaluate_rules

    def load(connection, verification_id):
        row = connection.execute("SELECT result, listing FROM verifications WHERE id=?", (str(verification_id),)).fetchone()
        if row is None:
            raise HTTPException(404, "Verification not found")
        return json.loads(row[0]), json.loads(row[1]) if row[1] else None

    @contextmanager
    def edit(verification_id, chain_hash):
        with closing(sqlite3.connect(database, timeout=20)) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            result, listing = load(connection, verification_id)
            if result["chain_hash"] != chain_hash:
                raise HTTPException(409, "Stale chain_hash. Reload the report.")
            if not audit(result)["valid"]:
                raise HTTPException(409, "Audit integrity check failed")
            if listing is None:
                raise HTTPException(409, "Legacy result has no saved listing. Submit a new verification.")
            yield connection, result, listing
            connection.execute("UPDATE verifications SET result=? WHERE id=?", (json.dumps(result), str(verification_id)))

    def reevaluate(connection, result, payload, trace):
        status, reason, rules = evaluate_rules(Listing(**payload), trace, service.state.extraction_client)
        rows = connection.execute(
            "SELECT declarations FROM evidence WHERE verification_id=? ORDER BY rowid DESC LIMIT 2",
            (result["id"],),
        ).fetchall()
        if rows and status != Status.UNKNOWN:
            record = registry.tool_registry_lookup(payload["registration_reference"])
            declaration = json.loads(rows[0][0])
            matches = bool(record and record.active and all(
                declaration[key].strip().casefold() == expected.strip().casefold()
                for key, expected in (
                    ("product_name", record.product_name), ("license_holder", record.license_holder),
                    ("registration_reference", payload["registration_reference"]),
                )
            ))
            evidence_rule = {
                "rule": "R-05", "result": "pass" if matches else "fail",
                "reason_en": "Declared evidence fields match registry" if matches else "Evidence conflict requires human review",
                "reason_th": "ตรวจสอบข้อมูลหลักฐานกับทะเบียน",
                "evidence": {"declarations_match": matches},
            }
            rules = [rule for rule in rules if rule["rule"] != "R-05"] + [evidence_rule]
            trace.add("R-05", json.dumps(evidence_rule, ensure_ascii=False, sort_keys=True))
            if not matches and status != Status.DENIED:
                status, reason = Status.PENDING, "evidence_conflict"
        confidence = {Status.UNKNOWN: 0.0, Status.PENDING: 0.60}.get(status, 1.0)
        trace.add("risk_policy", RISK_POLICY_HASH)
        trace.add("decision", reason)
        trace.add("review_routing", "required" if confidence < 0.75 else "clear")
        result.update(status=status.value, reason=reason, confidence=confidence,
            human_review_required=confidence < 0.75, rule_results=rules,
            trace=[entry.model_dump() for entry in trace.entries], chain_hash=trace.entries[-1].chain_hash)

    def continue_trace(result):
        return Trace([TraceEntry(**entry) for entry in result["trace"]])

    @service.post("/v1/verifications/{verification_id}/evidence", tags=["Seller"])
    async def evidence(
        verification_id: UUID, chain_hash: str = Form(...),
        product_name: str = Form(..., max_length=200),
        license_holder: str = Form(..., max_length=200),
        registration_reference: str = Form(..., max_length=200),
        label: UploadFile = File(...), certificate: UploadFile = File(...),
    ):
        """Upload synthetic demo evidence. Only file hashes and declared product fields are stored."""
        hashes = []
        for kind, upload in (("label", label), ("certificate", certificate)):
            digest = hashlib.sha256()
            size = 0
            while True:
                chunk = await upload.read(65536)
                if not chunk:
                    break
                size += len(chunk)
                if size > 2 * 1024 * 1024:
                    raise HTTPException(413, "Maximum evidence size is 2 MB per file")
                digest.update(chunk)
            if size == 0:
                raise HTTPException(422, "Evidence files must contain data")
            hashes.append((kind, digest.hexdigest()))
        declarations = dict(product_name=product_name, license_holder=license_holder, registration_reference=registration_reference)
        with edit(verification_id, chain_hash) as (connection, result, payload):
            trace = continue_trace(result)
            for kind, digest in hashes:
                connection.execute("INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?)", (
                    str(uuid4()), str(verification_id), kind, digest, json.dumps(declarations), datetime.now(timezone.utc).isoformat()))
                trace.add("evidence", json.dumps({"kind": kind, "sha256": digest, "chain_hash": chain_hash}))
            reevaluate(connection, result, payload, trace)
        return result

    @service.post("/v1/verifications/{verification_id}/recheck", tags=["Seller"])
    def recheck(verification_id: UUID, revision: Revision):
        with edit(verification_id, revision.chain_hash) as (connection, result, payload):
            trace = continue_trace(result)
            trace.add("recheck", "Requested with chain_hash " + revision.chain_hash)
            reevaluate(connection, result, payload, trace)
        return result

    @service.get("/v1/review-queue", tags=["Reviewer"])
    def queue():
        with closing(sqlite3.connect(database)) as connection:
            results = [json.loads(row[0]) for row in connection.execute("SELECT result FROM verifications")]
        pending = [dict(result, risk=risk(result), audit=audit(result)) for result in results if result["human_review_required"]]
        return sorted(pending, key=lambda result: (-result["risk"]["score"], result["id"]))

    @service.post("/v1/verifications/{verification_id}/review", tags=["Reviewer"])
    def review(verification_id: UUID, review: Review):
        with edit(verification_id, review.chain_hash) as (connection, result, payload):
            trace = continue_trace(result)
            reevaluate(connection, result, payload, trace)
            if review.decision == "approve" and (
                result["status"] == "UNKNOWN" or any(
                    rule["result"] == "fail" for rule in result["rule_results"]
                ) or result["confidence"] < 0.75
            ):
                raise HTTPException(409, "Resolve failed checks and uncertainty before approval")
            trace.add("human_review", json.dumps(dict(actor="demo-reviewer", **review.model_dump()), sort_keys=True))
            connection.execute("INSERT INTO reviews VALUES (?, ?, ?, ?, ?, ?)", (
                str(uuid4()), result["id"], review.decision, review.note, review.chain_hash, datetime.now(timezone.utc).isoformat()))
            result.update(status="APPROVED" if review.decision == "approve" else "DENIED",
                reason="reviewer_" + review.decision, confidence=1.0, human_review_required=False,
                trace=[entry.model_dump() for entry in trace.entries], chain_hash=trace.entries[-1].chain_hash)
        return result

    @service.get("/v1/audit/{verification_id}", tags=["Reports"])
    def audit_report(verification_id: UUID):
        with closing(sqlite3.connect(database)) as connection:
            result, _ = load(connection, verification_id)
        return audit(result)

    @service.get("/v1/reports/{verification_id}", tags=["Reports"])
    def report(verification_id: UUID):
        with closing(sqlite3.connect(database)) as connection:
            result, payload = load(connection, verification_id)
            evidence = [dict(zip(("kind", "sha256", "declarations"), row)) for row in connection.execute(
                "SELECT kind, sha256, declarations FROM evidence WHERE verification_id=?", (str(verification_id),))]
            for item in evidence:
                item["declarations"] = json.loads(item["declarations"])
        return dict(result, listing=payload, evidence=evidence, audit=audit(result), risk=risk(result), synthetic=True)

    @service.get("/v1/widgets/{verification_id}", tags=["Reports"])
    def widget(verification_id: UUID):
        with closing(sqlite3.connect(database)) as connection:
            result, _ = load(connection, verification_id)
        labels = {"APPROVED": "ผ่านการตรวจสอบข้อมูลจำลอง", "PENDING": "รอการตรวจสอบ", "DENIED": "ไม่ผ่านการตรวจสอบ", "UNKNOWN": "ไม่สามารถตรวจสอบได้"}
        return dict(status=result["status"], label_en=result["status"].title(), label_th=labels[result["status"]],
            report_url="/v1/reports/" + str(verification_id), synthetic=True)

    @service.post("/v1/products/compare", tags=["Reports"])
    def compare(comparison: Comparison):
        return {"products": [report(verification_id) for verification_id in comparison.ids], "synthetic": True}

    @service.post("/v1/listings/suggest-copy", tags=["Seller"])
    def suggest_copy(listing: Listing):
        """Return a minimal factual template and screen it with R-03. Submit it for a fresh decision."""
        from .rules import advertising_claims, RULES
        candidate = listing.model_copy(update={
            "title": "Product listing",
            "description": RULES["supplement_term"] if listing.category.casefold() == "supplement" else "Product details",
        })
        matches, missing = advertising_claims(candidate.title, candidate.description, candidate.category.casefold())
        trace = Trace()
        trace.add("copy_template", "Minimal factual template generated")
        trace.add("R-03", "pass" if not matches and not missing else "fail")
        return {"listing": candidate.model_dump(), "screened": not matches and not missing,
            "requires_verification": True, "method": "deterministic_template", "synthetic": True,
            "trace": [entry.model_dump() for entry in trace.entries], "chain_hash": trace.entries[-1].chain_hash}
