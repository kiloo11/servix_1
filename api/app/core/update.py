"""Self-update via the Docker Engine API over the unix socket — ported from
server.js's dockerRequest/runDockerUpdate/startUpdate/checkForUpdate/
fetchLatestRelease/fetchLatestTag/compareVersions family.

The container can't recreate itself (the daemon would kill this process
mid-update), so a one-shot watchtower helper container does it instead —
see runDockerUpdate()'s docstring-equivalent comment below, ported verbatim
in spirit from the original Russian comment.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import socket
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx

from app.core.config import get_app_version, get_settings
from app.core.dates import iso_from_timestamp, now_iso

logger = logging.getLogger(__name__)

UPDATE_CHECK_INTERVAL_SECONDS = 6 * 60 * 60


@dataclass
class UpdateCheck:
    checked_at: float = 0
    version: str = ""
    release_url: str = ""
    notes: str = ""
    published_at: str = ""
    error: str = ""


@dataclass
class UpdateRun:
    status: str = "idle"
    started_at: str = ""
    finished_at: str = ""
    message: str = ""
    log: list = field(default_factory=list)


_update_check = UpdateCheck()
_update_run = UpdateRun()
_background_tasks: set[asyncio.Task] = set()


def _parse_version(value: str) -> tuple[int, int, int] | None:
    match = re.match(r"^v?(\d+)\.(\d+)\.(\d+)", str(value or "").strip())
    if not match:
        return None
    return (int(match.group(1)), int(match.group(2)), int(match.group(3)))


def compare_versions(a: str, b: str) -> int | None:
    """1/0/-1, or None if either side couldn't be parsed — "couldn't compare"
    and "versions are equal" are different cases, otherwise the panel would
    offer a nonexistent update."""
    left = _parse_version(a)
    right = _parse_version(b)
    if left is None or right is None:
        return None
    for i in range(3):
        if left[i] != right[i]:
            return 1 if left[i] > right[i] else -1
    return 0


def _github_headers() -> dict[str, str]:
    settings = get_settings()
    headers = {"accept": "application/vnd.github+json", "user-agent": f"servix/{get_app_version()}"}
    if settings.github_token:
        headers["authorization"] = f"Bearer {settings.github_token}"
    return headers


async def _fetch_latest_release() -> dict:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"https://api.github.com/repos/{settings.update_repo_clean}/releases/latest",
            headers=_github_headers(),
        )
        # No releases published yet -> GitHub returns 404, fall back to tags.
        if response.status_code == 404:
            return await _fetch_latest_tag()
        if response.is_error:
            raise RuntimeError(f"GitHub HTTP {response.status_code}")
        data = response.json()
    return {
        "version": re.sub(r"^v", "", str(data.get("tag_name") or data.get("name") or "")),
        "release_url": str(data.get("html_url") or ""),
        "notes": str(data.get("body") or "")[:4000],
        "published_at": str(data.get("published_at") or ""),
    }


async def _fetch_latest_tag() -> dict:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"https://api.github.com/repos/{settings.update_repo_clean}/tags",
            params={"per_page": 100},
            headers=_github_headers(),
        )
        if response.is_error:
            raise RuntimeError(f"GitHub HTTP {response.status_code}")
        tags = response.json()
    # Tags arrive in repo order, not version order - pick the max ourselves.
    best = ""
    for tag in tags if isinstance(tags, list) else []:
        name = re.sub(r"^v", "", str((tag or {}).get("name") or ""))
        if _parse_version(name) is None:
            continue
        if not best or (compare_versions(name, best) or 0) > 0:
            best = name
    repo = settings.update_repo_clean
    return {
        "version": best,
        "release_url": f"https://github.com/{repo}/releases/tag/{best}" if best else f"https://github.com/{repo}",
        "notes": "",
        "published_at": "",
    }


def docker_available() -> bool:
    settings = get_settings()
    return bool(settings.docker_socket) and os.path.exists(settings.docker_socket)


def update_status() -> dict:
    settings = get_settings()
    latest = _update_check.version or ""
    diff = compare_versions(latest, get_app_version())
    return {
        "version": get_app_version(),
        "latest": latest,
        "repo": settings.update_repo_clean,
        "updateAvailable": diff is not None and diff > 0,
        "releaseUrl": _update_check.release_url or f"https://github.com/{settings.update_repo_clean}/releases",
        "notes": _update_check.notes or "",
        "publishedAt": _update_check.published_at or "",
        "checkedAt": iso_from_timestamp(_update_check.checked_at) if _update_check.checked_at else "",
        "error": _update_check.error or "",
        "canApply": docker_available(),
        "apply": {
            "status": _update_run.status,
            "startedAt": _update_run.started_at,
            "finishedAt": _update_run.finished_at,
            "message": _update_run.message,
            "log": list(_update_run.log),
        },
    }


async def check_for_update(force: bool = False) -> dict:
    global _update_check
    now = time.time()
    if not force and _update_check.checked_at and now - _update_check.checked_at < UPDATE_CHECK_INTERVAL_SECONDS:
        return update_status()
    try:
        release = await _fetch_latest_release()
        _update_check = UpdateCheck(checked_at=now, error="", **release)
    except Exception as error:  # noqa: BLE001 - matches server.js's catch-and-record-error
        _update_check.checked_at = now
        _update_check.error = str(error)
    return update_status()


def _update_log(message: str) -> None:
    _update_run.log = (_update_run.log + [{"at": now_iso(), "message": message}])[-40:]
    logger.info("Update: %s", message)


async def _docker_request(method: str, path: str, body: dict | None = None, timeout: float = 120) -> dict:
    settings = get_settings()
    transport = httpx.AsyncHTTPTransport(uds=settings.docker_socket)
    async with httpx.AsyncClient(transport=transport, base_url="http://docker", timeout=timeout) as client:
        response = await client.request(method, path, json=body)
    if response.status_code >= 400:
        raise RuntimeError(f"Docker {method} {path}: HTTP {response.status_code} {response.text[:200]}")
    try:
        data = response.json() if response.text else None
    except ValueError:
        data = None
    return {"status": response.status_code, "data": data, "text": response.text}


async def _run_docker_update() -> None:
    settings = get_settings()
    await _docker_request("GET", "/_ping", timeout=10)
    self_name = settings.update_container or socket.gethostname()
    info = await _docker_request("GET", f"/containers/{self_name}/json", timeout=15)
    data = info["data"] or {}
    name = str(data.get("Name") or "").lstrip("/") or self_name
    image = str((data.get("Config") or {}).get("Image") or "")
    _update_log(f"Контейнер: {name}{f', образ: {image}' if image else ''}")

    helper_image, _, helper_tag = settings.update_helper_image.partition(":")
    helper_tag = helper_tag or "latest"
    _update_log(f"Загружаю образ обновлятора {helper_image}:{helper_tag}")
    await _docker_request(
        "POST", f"/images/create?fromImage={helper_image}&tag={helper_tag}", timeout=300
    )

    created = await _docker_request(
        "POST",
        f"/containers/create?name=servix-updater-{int(datetime.now().timestamp() * 1000)}",
        {
            "Image": settings.update_helper_image,
            "Cmd": ["--run-once", "--cleanup", name],
            "HostConfig": {"AutoRemove": True, "Binds": [f"{settings.docker_socket}:/var/run/docker.sock"]},
        },
        timeout=30,
    )
    helper_id = str((created["data"] or {}).get("Id") or "")
    if not helper_id:
        raise RuntimeError("Docker не вернул id контейнера обновления")

    await _docker_request("POST", f"/containers/{helper_id}/start", timeout=30)
    _update_log("Обновлятор запущен, панель перезапустится через несколько минут")


async def _run_docker_update_tracked() -> None:
    global _update_run
    try:
        await _run_docker_update()
        _update_run.status = "done"
        _update_run.finished_at = now_iso()
        _update_run.message = "Обновление запущено"
    except Exception as error:  # noqa: BLE001 - matches server.js's catch-and-record-error
        _update_run.status = "error"
        _update_run.finished_at = now_iso()
        _update_run.message = str(error)
        _update_log(f"Ошибка: {error}")


def start_update() -> dict:
    global _update_run
    settings = get_settings()
    if _update_run.status == "running":
        raise ValueError("Обновление уже запущено")
    if not docker_available():
        raise ValueError(f"Docker-сокет {settings.docker_socket} недоступен: проброс сокета в контейнер не настроен")
    _update_run = UpdateRun(status="running", started_at=now_iso())
    _update_log(f"Обновление {get_app_version()} -> {_update_check.version or 'latest'}")
    # Respond immediately: the request must not wait for the restart that
    # would itself cut the request off.
    task = asyncio.create_task(_run_docker_update_tracked())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return update_status()
