"""api/app/core/demo_data.py — the local-dev demo seeding (SEED_DEMO_DATA=true)
ported from server.js's seedDemoAssets/seedDemoBotRevenueMonthly. Run via
subprocess against its own scratch DATA_DIR, same reasoning as
test_migration_bootstrap.py: get_settings() is process-wide and lru_cached,
so the only clean way to exercise SEED_DEMO_DATA against an isolated DB is a
separate interpreter per scenario — the suite's shared session-scoped DB
already has providers/assets in it by the time this file's tests would run
(from the CRUD tests), which would make the "only seed an empty DB" guard a
silent, order-dependent no-op instead of a real assertion.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from sqlite3 import connect

API_DIR = Path(".").resolve()

_SEED_SNIPPET = """
import sys
sys.path.insert(0, ".")
from app.main import run_migrations
run_migrations()
from app.core.db import SessionLocal
from app.core.demo_data import seed_demo_data
db = SessionLocal()
seed_demo_data(db)
seed_demo_data(db)  # second call must be a no-op, not a duplicate
db.close()
"""


def _run_seed(data_dir: Path, seed_flag: str) -> subprocess.CompletedProcess:
    data_dir.mkdir(parents=True, exist_ok=True)
    return subprocess.run(
        [sys.executable, "-c", _SEED_SNIPPET],
        cwd=API_DIR,
        env={"DATA_DIR": str(data_dir), "SEED_DEMO_DATA": seed_flag, "PATH": "/usr/bin:/bin"},
        capture_output=True,
        text=True,
        timeout=60,
    )


def test_seed_demo_data_populates_providers_assets_and_bot_revenue(tmp_path):
    result = _run_seed(tmp_path, "true")
    assert result.returncode == 0, result.stderr

    conn = connect(tmp_path / "servix.sqlite")
    try:
        assert conn.execute("SELECT count(*) FROM providers").fetchone()[0] == 4
        assert conn.execute("SELECT count(*) FROM assets").fetchone()[0] == 9
        assert conn.execute("SELECT count(*) FROM assets WHERE type = 'vps'").fetchone()[0] == 5
        assert conn.execute("SELECT count(*) FROM payments").fetchone()[0] > 0
        assert conn.execute("SELECT count(*) FROM bot_revenue_monthly").fetchone()[0] > 0
    finally:
        conn.close()


def test_seed_demo_data_off_by_default(tmp_path):
    result = _run_seed(tmp_path, "false")
    assert result.returncode == 0, result.stderr

    conn = connect(tmp_path / "servix.sqlite")
    try:
        assert conn.execute("SELECT count(*) FROM providers").fetchone()[0] == 0
        assert conn.execute("SELECT count(*) FROM assets").fetchone()[0] == 0
        assert conn.execute("SELECT count(*) FROM bot_revenue_monthly").fetchone()[0] == 0
    finally:
        conn.close()
