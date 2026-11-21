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
