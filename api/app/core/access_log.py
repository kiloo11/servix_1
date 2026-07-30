"""Access log — same JSONL-per-line file as server.js's logAction/readAccessLog,
so `/api/logs` keeps reading history written by the old backend across cutover.
"""

from __future__ import annotations

import json

from fastapi import Request

from app.core.config import get_settings
from app.core.dates import now_iso
from app.core.deps import client_ip


async def log_action(request: Request, action: str, details: dict | None = None, status: int = 200) -> None:
    entry = {
        "at": now_iso(),
        "action": action,
        "method": request.method,
        "path": request.url.path,
        "status": status,
        "ip": client_ip(request),
        "details": details or {},
    }
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    try:
        with settings.access_log_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError as error:
        print(f"Access log write failed: {error}")


def read_access_log(limit: int = 1000) -> list[dict]:
    settings = get_settings()
    try:
        raw = settings.access_log_file.read_text(encoding="utf-8")
    except FileNotFoundError:
        return []
    lines = [line for line in raw.strip().split("\n") if line]
    items = []
    for index, line in enumerate(reversed(lines[-limit:])):
        try:
            parsed = json.loads(line)
            items.append({"id": f"{index}-{len(line)}", **parsed})
        except json.JSONDecodeError:
            items.append({"id": f"broken-{index}", "at": "", "action": "broken", "method": "", "path": "", "status": 0, "ip": "", "details": {"line": line}})
    return items
