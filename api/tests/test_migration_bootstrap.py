"""run_migrations()'s self-healing bootstrap (app/main.py). Exercised via
subprocess, not by importing app.main directly: the app binds its SQLAlchemy
engine and alembic's env.py both read DATA_DIR through the process-wide,
lru_cache'd get_settings() at call time, so the only way to point separate
runs at separate scratch databases without fighting that global cache is to
give each scenario its own interpreter — this also happens to exercise the
exact real startup code path instead of a partially-mocked stand-in.

Real-world grounding: scenario 3 (existing tables, an `alembic_version`
table already present but with zero rows) isn't a hypothetical — it was
found, investigated, and confirmed harmless on a copy of the actual
production DB while writing this test (debris from an earlier pre-bootstrap
`upgrade head` attempt that hit "table already exists" and crashed before
ever inserting its version row; SQLite DDL failures don't touch unrelated
tables, so the real data itself was never at risk).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from sqlite3 import connect

API_DIR = Path(__file__).resolve().parent.parent

_RUN_MIGRATIONS_SNIPPET = """
import sys
sys.path.insert(0, ".")
from app.main import run_migrations
run_migrations()
"""

# Builds only the initial-schema migration's tables — i.e. exactly what
# server.js's own initDb() would have produced, before the Bedolaga
# migration ever existed — instead of run_migrations()'s hardcoded "head".
_UPGRADE_TO_INITIAL_SCHEMA_SNIPPET = """
import sys
sys.path.insert(0, ".")
from pathlib import Path
from alembic import command
from alembic.config import Config

API_DIR = Path(".").resolve()
config = Config(str(API_DIR / "alembic.ini"))
config.set_main_option("script_location", str(API_DIR / "alembic"))
command.upgrade(config, "6d2d497a11f9")
"""


def _run_migrations_against(data_dir: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-c", _RUN_MIGRATIONS_SNIPPET],
        cwd=API_DIR,
        env={"DATA_DIR": str(data_dir), "PATH": "/usr/bin:/bin"},
        capture_output=True,
        text=True,
        timeout=60,
    )


def _db_state(db_file: Path) -> tuple[str | None, list[str], int]:
    conn = connect(db_file)
    try:
        version = conn.execute("SELECT version_num FROM alembic_version").fetchone()
        tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        category_count = conn.execute("SELECT count(*) FROM categories").fetchone()[0]
        return (version[0] if version else None, tables, category_count)
    finally:
        conn.close()


def _build_legacy_schema(data_dir: Path, *, drop_alembic_version_table: bool, seed_row: bool) -> None:
    """Builds a DB matching what server.js's initDb() would have produced —
    the tables from the initial-schema migration, no Bedolaga tables, and
    (per the two real leftover states seen on production) either no
    alembic_version table at all or one that exists but is empty."""
    data_dir.mkdir(parents=True)
    result = subprocess.run(
        [sys.executable, "-c", _UPGRADE_TO_INITIAL_SCHEMA_SNIPPET],
        cwd=API_DIR,
        env={"DATA_DIR": str(data_dir), "PATH": "/usr/bin:/bin"},
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr

    db_file = data_dir / "servix.sqlite"
    conn = connect(db_file)
    try:
        if seed_row:
            conn.execute(
                "INSERT INTO categories (id, name, color, sort_order, created_at, updated_at) "
                "VALUES ('infra', 'Инфраструктура', '#cf00a3', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
            )
        if drop_alembic_version_table:
            conn.execute("DROP TABLE alembic_version")
        else:
            conn.execute("DELETE FROM alembic_version")
        conn.commit()
    finally:
        conn.close()


def test_fresh_install_upgrades_from_scratch(tmp_path):
    data_dir = tmp_path / "fresh"
    data_dir.mkdir()

    result = _run_migrations_against(data_dir)

    assert result.returncode == 0, result.stderr
    version, tables, _ = _db_state(data_dir / "servix.sqlite")
    assert version == "0d23a6383b34"
    assert "bedolaga_transactions" in tables


def test_node_created_data_with_no_alembic_table_is_stamped_then_upgraded(tmp_path):
    data_dir = tmp_path / "node-legacy"
    _build_legacy_schema(data_dir, drop_alembic_version_table=True, seed_row=True)

    result = _run_migrations_against(data_dir)

    assert result.returncode == 0, result.stderr
    version, tables, category_count = _db_state(data_dir / "servix.sqlite")
    assert version == "0d23a6383b34"
    assert "bedolaga_users" in tables
    assert category_count == 1  # pre-existing row survived the bootstrap untouched


def test_leftover_empty_alembic_version_table_is_healed(tmp_path):
    """Reproduces the exact state found on the real production DB: the
    tracking table exists but has zero rows (debris from an earlier failed
    `upgrade head` attempt), not the "table absent entirely" case above."""
    data_dir = tmp_path / "debris"
    _build_legacy_schema(data_dir, drop_alembic_version_table=False, seed_row=True)

    version_before, _, _ = _db_state(data_dir / "servix.sqlite")
    assert version_before is None  # confirms the fixture actually reproduces the empty-table state

    result = _run_migrations_against(data_dir)

    assert result.returncode == 0, result.stderr
    version, tables, category_count = _db_state(data_dir / "servix.sqlite")
    assert version == "0d23a6383b34"
    assert "bedolaga_subscriptions" in tables
    assert category_count == 1


def test_already_current_db_is_a_noop(tmp_path):
    data_dir = tmp_path / "current"
    data_dir.mkdir()
    first = _run_migrations_against(data_dir)
    assert first.returncode == 0, first.stderr

    second = _run_migrations_against(data_dir)

    assert second.returncode == 0, second.stderr
    version, _, _ = _db_state(data_dir / "servix.sqlite")
    assert version == "0d23a6383b34"
