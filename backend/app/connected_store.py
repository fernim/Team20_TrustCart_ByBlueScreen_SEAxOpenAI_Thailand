"""Additive storage for shop-owned listings and private verification submissions."""

import json
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from . import database as store


def now():
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def transaction(database):
    with closing(store.connect(database)) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        yield connection


def initialize(connection):
    binary = "BYTEA" if getattr(connection, "dialect", "") == "postgresql" else "BLOB"
    definitions = {
        "tc_shops": "id TEXT PRIMARY KEY, name TEXT NOT NULL",
        "tc_accounts": "id TEXT PRIMARY KEY, role TEXT NOT NULL, shop_id TEXT REFERENCES tc_shops(id)",
        "tc_sessions": "id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES tc_accounts(id), csrf TEXT NOT NULL, expires_at REAL NOT NULL",
        "tc_plans": "id TEXT PRIMARY KEY REFERENCES tc_shops(id), active_until TEXT NOT NULL",
        "tc_owners": "id TEXT PRIMARY KEY REFERENCES products(id), shop_id TEXT NOT NULL REFERENCES tc_shops(id), active_submission TEXT",
        "tc_submissions": "id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), shop_id TEXT NOT NULL REFERENCES tc_shops(id), revision INTEGER NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL",
        "tc_documents": f"id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), shop_id TEXT NOT NULL REFERENCES tc_shops(id), kind TEXT NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL, digest TEXT NOT NULL, content {binary} NOT NULL, created_at TEXT NOT NULL",
    }
    for table, columns in definitions.items():
        connection.execute(f"CREATE TABLE IF NOT EXISTS {table} ({columns})")
    for table, columns in [
        ("tc_owners", "shop_id"),
        ("tc_submissions", "shop_id, product_id"),
        ("tc_documents", "product_id"),
        ("tc_sessions", "account_id"),
    ]:
        connection.execute(
            f"CREATE INDEX IF NOT EXISTS {table}_lookup ON {table} ({columns})"
        )
    for shop, name in [
        ("shop1", "TrustCart Demo Shop"),
        ("shop2", "BlueScreen Health Shop"),
    ]:
        connection.execute(
            "INSERT INTO tc_shops VALUES (?,?) ON CONFLICT(id) DO NOTHING", (shop, name)
        )
    for account, role, shop in [
        ("buyer", "buyer", None),
        ("seller1", "seller", "shop1"),
        ("seller2", "seller", "shop2"),
        ("reviewer", "reviewer", None),
    ]:
        connection.execute(
            "INSERT INTO tc_accounts VALUES (?,?,?) ON CONFLICT(id) DO NOTHING",
            (account, role, shop),
        )
    connection.execute(
        "INSERT INTO tc_owners (id,shop_id) SELECT id,'shop1' FROM products WHERE id NOT IN (SELECT id FROM tc_owners)"
    )


    # Additive JSON migration: preserve product versions and verification snapshots.
    for product_id, raw in connection.execute("SELECT id,result FROM products").fetchall():
        product = json.loads(raw)
        if "marketplace" not in product:
            product["marketplace"] = "shopee"
            connection.execute("UPDATE products SET result=? WHERE id=?", (json.dumps(product), product_id))


def read_product(connection, product_id, shop_id=None):
    from fastapi import HTTPException

    owner = connection.execute(
        "SELECT shop_id,active_submission FROM tc_owners WHERE id=?", (str(product_id),)
    ).fetchone()
    if not owner or (shop_id is not None and owner[0] != shop_id):
        raise HTTPException(404, "Product not found")
    row = connection.execute(
        "SELECT result FROM products WHERE id=?", (str(product_id),)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Product not found")
    return json.loads(row[0]), owner


def read_submission(connection, submission_id, shop_id=None):
    from fastapi import HTTPException

    row = connection.execute(
        "SELECT result FROM tc_submissions WHERE id=?", (str(submission_id),)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Submission not found")
    result = json.loads(row[0])
    if shop_id is not None and result["shop_id"] != shop_id:
        raise HTTPException(404, "Submission not found")
    return result


def save_submission(connection, result):
    connection.execute(
        "UPDATE tc_submissions SET result=? WHERE id=?",
        (json.dumps(result, ensure_ascii=False), result["id"]),
    )
