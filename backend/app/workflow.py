import hashlib
import json
from . import database as store
from contextlib import closing, contextmanager
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from fastapi import HTTPException
from pydantic import BaseModel, Field

from .verification import Listing, Status, Trace, TraceEntry, evaluate_rules

_POLICY_BYTES = (Path(__file__).resolve().parent.parent / "data" / "risk_policy.json").read_bytes()
RISK_POLICY = json.loads(_POLICY_BYTES)
RISK_POLICY_HASH = hashlib.sha256(_POLICY_BYTES).hexdigest()


class Revision(BaseModel):
    chain_hash: str = Field(
        min_length=64, max_length=64, description="The latest chain_hash returned for this verification."
    )


class Review(Revision):
    decision: Literal["approve", "deny"]
    note: str = Field(min_length=1, max_length=1000)


class Comparison(BaseModel):
    ids: list[UUID] = Field(min_length=1, max_length=10)


def initialize_store(connection) -> None:
    if getattr(connection, "dialect", "sqlite") == "postgresql":
        from .database import initialize_postgres
        initialize_postgres(connection)
        return
    connection.execute("CREATE TABLE IF NOT EXISTS verifications (id TEXT PRIMARY KEY, result TEXT NOT NULL)")
    columns = {row[1] for row in connection.execute("PRAGMA table_info(verifications)")}
    if "listing" not in columns:
        connection.execute("ALTER TABLE verifications ADD COLUMN listing TEXT")
    if connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='verification_listings'").fetchone():
        connection.execute("""
            UPDATE verifications
            SET listing = (SELECT listing FROM verification_listings WHERE verification_id = verifications.id)
            WHERE listing IS NULL
        """)

    evidence_columns = {row[1] for row in connection.execute("PRAGMA table_info(evidence)")}
    legacy_evidence = "label_sha256" in evidence_columns
    if legacy_evidence:
        connection.execute("ALTER TABLE evidence RENAME TO evidence_previous")
    connection.execute("""
        CREATE TABLE IF NOT EXISTS evidence (
            id TEXT PRIMARY KEY, verification_id TEXT NOT NULL, kind TEXT NOT NULL,
            sha256 TEXT NOT NULL, declarations TEXT NOT NULL, created_at TEXT NOT NULL
        )
    """)
    if legacy_evidence:
        rows = connection.execute("""
            SELECT verification_id, identity, label_sha256, certificate_sha256, created_at
            FROM evidence_previous ORDER BY id
        """)
        connection.executemany(
            "INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?)",
            (
                (str(uuid4()), verification_id, kind, digest, identity, created_at)
                for verification_id, identity, label_hash, certificate_hash, created_at in rows
                for kind, digest in (("label", label_hash), ("certificate", certificate_hash))
            ),
        )
        connection.execute("DROP TABLE evidence_previous")
    connection.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY, verification_id TEXT NOT NULL, decision TEXT NOT NULL,
            note TEXT NOT NULL, prev_chain_hash TEXT NOT NULL, created_at TEXT NOT NULL
        )
    """)


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


def load(connection, verification_id):
    row = connection.execute("SELECT result, listing FROM verifications WHERE id=?", (str(verification_id),)).fetchone()
    if row is None:
        raise HTTPException(404, "Verification not found")
    return json.loads(row[0]), json.loads(row[1]) if row[1] else None


@contextmanager
def edit(database: Path, verification_id: UUID, chain_hash: str):
    with closing(store.connect(database, timeout=20)) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        result, listing = load(connection, verification_id)
        if result["chain_hash"] != chain_hash:
            raise HTTPException(409, "Stale chain_hash. Reload the report.")
        if not audit(result)["valid"]:
            raise HTTPException(409, "Audit integrity check failed")
        if listing is None:
            raise HTTPException(409, "Legacy result has no saved listing. Submit a new verification.")
        if listing.get("advertising_permit_conflict") and not listing.get("advertising_permit"):
            raise HTTPException(409, "Legacy permit conflict has no permit number. Submit a new verification with the permit.")
        yield connection, result, listing
        connection.execute("UPDATE verifications SET result=? WHERE id=?", (json.dumps(result), str(verification_id)))


def reevaluate(connection, result, payload, trace, extraction_client):
    row = connection.execute(
        "SELECT declarations FROM evidence WHERE verification_id=? ORDER BY rowid DESC LIMIT 1",
        (result["id"],),
    ).fetchone()
    declarations = json.loads(row[0]) if row is not None else None
    listing = Listing(**payload)
    listing.simulate_registry_outage = False
    status, reason, rules = evaluate_rules(
        listing, trace, extraction_client, declarations=declarations,
    )
    confidence = {Status.UNKNOWN: 0.0, Status.PENDING: 0.60}.get(status, 1.0)
    trace.add("risk_policy", RISK_POLICY_HASH)
    trace.add("decision", reason)
    trace.add("review_routing", "required" if confidence < 0.75 else "clear")
    result.update(status=status.value, reason=reason, confidence=confidence,
        human_review_required=confidence < 0.75, rule_results=rules,
        trace=[entry.model_dump() for entry in trace.entries], chain_hash=trace.entries[-1].chain_hash)


def continue_trace(result):
    return Trace([TraceEntry(**entry) for entry in result["trace"]])
