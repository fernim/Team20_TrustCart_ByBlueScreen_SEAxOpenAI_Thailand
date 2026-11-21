"""Local SQLite or explicitly configured shared PostgreSQL storage."""
import os
import sqlite3
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


class PostgresConnection:
    dialect = "postgresql"

    def __init__(self, raw):
        self.raw = raw
        self.lock_rows = False

    def execute(self, sql, params=()):
        if sql.strip().upper() == "BEGIN IMMEDIATE":
            self.lock_rows = True
            return self.raw.execute("SELECT 1")
        statement = sql.replace("?", "%s")
        normalized = statement.strip().upper()
        if self.lock_rows and normalized.startswith("SELECT ") and " WHERE ID=" in normalized:
            statement += " FOR UPDATE"
        return self.raw.execute(statement, params)

    def __enter__(self):
        return self

    def __exit__(self, error_type, error, traceback):
        if error_type is None:
            self.raw.commit()
        else:
            self.raw.rollback()

    def close(self):
        self.raw.close()


def database_url():
    url = os.environ.get("TRUSTCART_DATABASE_URL")
    if url or os.environ.get("VERCEL") != "1" or not os.environ.get("SUPABASE_URL"):
        return url

    parts = urlsplit(os.environ.get("POSTGRES_URL", ""))
    if parts.scheme not in {"postgresql", "postgres"} or not parts.hostname:
        raise ValueError("The Supabase integration must provide a PostgreSQL POSTGRES_URL")

    # The integration can include provider and JavaScript-driver hints that libpq rejects.
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.pop("supa", None)
    if query.get("workaround") == "supabase-pooler.vercel":
        del query["workaround"]
    query.setdefault("sslmode", "require")
    return urlunsplit(parts._replace(query=urlencode(query)))


def connect(path, timeout=10):
    url = database_url()
    if not url:
        return sqlite3.connect(path, timeout=timeout)
    if not url.startswith(("postgresql://", "postgres://")):
        raise ValueError("TRUSTCART_DATABASE_URL must be a PostgreSQL connection string")
    import psycopg
    raw = psycopg.connect(url, connect_timeout=int(timeout), prepare_threshold=None)
    try:
        # Supavisor can assign a different backend for each transaction.
        # Psycopg starts the transaction before executing this statement.
        raw.execute("SET LOCAL search_path TO trustcart", ())
    except psycopg.Error:
        raw.close()
        raise
    return PostgresConnection(raw)


def initialize_postgres(connection):
    # Serialize concurrent cold starts and keep this application's tables isolated.
    connection.execute("SELECT pg_advisory_xact_lock(202620)")
    connection.execute("CREATE SCHEMA IF NOT EXISTS trustcart")
    definitions = {
        "verifications": "id TEXT PRIMARY KEY, result TEXT NOT NULL, listing TEXT",
        "products": "id TEXT PRIMARY KEY, version INTEGER NOT NULL, result TEXT NOT NULL",
        "evidence": "id TEXT PRIMARY KEY, verification_id TEXT NOT NULL REFERENCES verifications(id), kind TEXT NOT NULL, sha256 TEXT NOT NULL, declarations TEXT NOT NULL, created_at TEXT NOT NULL",
        "reviews": "id TEXT PRIMARY KEY, verification_id TEXT NOT NULL REFERENCES verifications(id), decision TEXT NOT NULL, note TEXT NOT NULL, prev_chain_hash TEXT NOT NULL, created_at TEXT NOT NULL",
    }
    for table, columns in definitions.items():
        connection.execute("CREATE TABLE IF NOT EXISTS " + table + " (" + columns + ", rowid BIGINT GENERATED ALWAYS AS IDENTITY)")
    connection.execute("CREATE INDEX IF NOT EXISTS evidence_verification_order ON evidence (verification_id, rowid DESC)")
    connection.execute("CREATE INDEX IF NOT EXISTS reviews_verification_order ON reviews (verification_id, rowid DESC)")
