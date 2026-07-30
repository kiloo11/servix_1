"""Environment configuration — mirrors the constants at the top of the
original server.js exactly (same env var names/defaults) so existing
docker-compose.yml / .env files keep working unchanged after cutover.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 3000
    site_title: str = "SERVIX"
    # Same default as server.js: relative to the repo root (api/'s parent),
    # not this package — DATA_DIR is always set explicitly in real deploys
    # anyway (docker-compose), this only matters for bare local runs.
    data_dir: Path = APP_DIR.parent / "data"
    public_dir: Path = APP_DIR.parent / "dist"
    locale_dir: Path = APP_DIR.parent / "locale"

    telegram_notify_url: str = ""
    bedolaga_api_url: str = ""
    bedolaga_api_key: str = ""
    notify_on_start: bool = True
    app_timezone: str = "Europe/Moscow"

    cookie_secure: bool = False

    update_repo: str = "kiloo11/servix_1"
    update_container: str = ""
    update_helper_image: str = "containrrr/watchtower:latest"
    docker_socket: str = "/var/run/docker.sock"
    github_token: str = ""

    seed_demo_data: bool = False

    @property
    def db_file(self) -> Path:
        return self.data_dir / "servix.sqlite"

    @property
    def access_log_file(self) -> Path:
        return self.data_dir / "access.log"

    @property
    def bedolaga_api_url_clean(self) -> str:
        return re.sub(r"/+$", "", self.bedolaga_api_url.strip())

    @property
    def update_repo_clean(self) -> str:
        value = self.update_repo.strip()
        value = re.sub(r"^https?://github\.com/", "", value)
        return re.sub(r"/+$", "", value)


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_app_version() -> str:
    """Same source of truth as server.js: the repo-root package.json — the
    release workflow already refuses to tag a version that disagrees with
    it, so this stays true for both backends without duplicating it."""
    import json

    try:
        data = json.loads((APP_DIR.parent / "package.json").read_text(encoding="utf-8"))
        return str(data.get("version", "0.0.0"))
    except (OSError, json.JSONDecodeError):
        return "0.0.0"
