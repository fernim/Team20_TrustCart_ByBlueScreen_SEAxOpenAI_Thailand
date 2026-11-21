import pytest
from backend.app import database


class RawConnection:
    def __init__(self):
        self.calls = []
        self.committed = False
        self.rolled_back = False

    def execute(self, sql, params=()):
        self.calls.append((sql, params))
        return self

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        pass


def test_postgres_preserves_parameter_binding_and_locks_mutations():
    raw = RawConnection()
    with database.PostgresConnection(raw) as connection:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute("SELECT result, listing FROM verifications WHERE id=?", ("synthetic-id",))
    assert raw.calls[-1] == ("SELECT result, listing FROM verifications WHERE id=%s FOR UPDATE", ("synthetic-id",))
    assert raw.committed


def test_postgres_rolls_back_failed_mutation():
    raw = RawConnection()
    with pytest.raises(ValueError):
        with database.PostgresConnection(raw):
            raise ValueError("Synthetic failure")
    assert raw.rolled_back and not raw.committed


def test_database_does_not_fall_back_for_invalid_shared_configuration(tmp_path, monkeypatch):
    monkeypatch.setenv("TRUSTCART_DATABASE_URL", "unsupported://synthetic")
    with pytest.raises(ValueError, match="PostgreSQL"):
        database.connect(tmp_path / "db.sqlite3")
    assert not (tmp_path / "db.sqlite3").exists()


def test_postgres_connector_uses_transaction_local_schema_for_supavisor(tmp_path, monkeypatch):
    import psycopg

    url = "postgresql://synthetic@aws-0-example.pooler.supabase.com:6543/postgres?sslmode=require"
    monkeypatch.setenv("TRUSTCART_DATABASE_URL", url)
    raw = RawConnection()

    def pooler_connect(conninfo, *, connect_timeout, prepare_threshold):
        assert conninfo == url
        assert connect_timeout == 10
        assert prepare_threshold is None
        return raw

    monkeypatch.setattr(psycopg, "connect", pooler_connect)
    connection = database.connect(tmp_path / "unused.sqlite3")
    try:
        with connection:
            connection.execute("SELECT result FROM verifications WHERE id=?", ("synthetic-id",))
    finally:
        connection.close()
    assert raw.calls == [
        ("SET LOCAL search_path TO trustcart", ()),
        ("SELECT result FROM verifications WHERE id=%s", ("synthetic-id",)),
    ]
    assert raw.committed


def test_vercel_uses_the_synced_supabase_secret_when_no_override_is_set(tmp_path, monkeypatch):
    import psycopg

    endpoint = "postgresql://synthetic@aws-0-example.pooler.supabase.com:6543/postgres"
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("SUPABASE_URL", "https://synthetic.supabase.co")
    monkeypatch.setenv("POSTGRES_URL", endpoint + "?supa=base-pooler.synthetic&workaround=supabase-pooler.vercel")
    calls = []

    def postgres_connect(conninfo, **options):
        calls.append(conninfo)
        return RawConnection()

    monkeypatch.setattr(psycopg, "connect", postgres_connect)
    database.connect(tmp_path / "fallback.sqlite3").close()
    assert calls == [endpoint + "?sslmode=require"]

    override = "postgresql://localhost/synthetic"
    monkeypatch.setenv("TRUSTCART_DATABASE_URL", override)
    database.connect(tmp_path / "fallback.sqlite3").close()
    assert calls[-1] == override
    assert not (tmp_path / "fallback.sqlite3").exists()


def test_missing_vercel_supabase_secret_does_not_silently_use_sqlite(tmp_path, monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setenv("SUPABASE_URL", "https://synthetic.supabase.co")
    monkeypatch.delenv("POSTGRES_URL", raising=False)
    fallback = tmp_path / "fallback.sqlite3"
    with pytest.raises(ValueError, match="POSTGRES_URL"):
        database.connect(fallback)
    assert not fallback.exists()


def test_supabase_marker_does_not_select_remote_storage_outside_vercel(tmp_path, monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setenv("SUPABASE_URL", "https://synthetic.supabase.co")
    monkeypatch.setenv("POSTGRES_URL", "postgresql://synthetic.invalid/db")
    fallback = tmp_path / "fallback.sqlite3"
    database.connect(fallback).close()
    assert fallback.exists()
