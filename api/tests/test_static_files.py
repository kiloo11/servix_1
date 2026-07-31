"""serve_static() (app/core/static_files.py) — literal-file / per-route
index.html / root-shell fallback chain, cache-control rules, and the
path-traversal guard. Calls serve_static() directly rather than going
through TestClient/the app's catch-all route, since this is a pure
function of (request_path, public_dir) and doesn't need a running app."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core import static_files


def _configure_public_dir(monkeypatch, path):
    monkeypatch.setattr(static_files, "get_settings", lambda: SimpleNamespace(public_dir=path))


def test_serves_literal_file(tmp_path, monkeypatch):
    _configure_public_dir(monkeypatch, tmp_path)
    (tmp_path / "manifest.webmanifest").write_text("{}")

    response = static_files.serve_static("manifest.webmanifest")

    assert response.path == tmp_path / "manifest.webmanifest"
    assert response.media_type == "application/manifest+json; charset=utf-8"
    assert response.headers["cache-control"] == "no-cache"


def test_next_static_asset_gets_immutable_cache_control(tmp_path, monkeypatch):
    _configure_public_dir(monkeypatch, tmp_path)
    asset_dir = tmp_path / "_next" / "static"
    asset_dir.mkdir(parents=True)
    (asset_dir / "chunk.js").write_text("console.log(1)")

    response = static_files.serve_static("_next/static/chunk.js")

    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_falls_back_to_route_index_html(tmp_path, monkeypatch):
    _configure_public_dir(monkeypatch, tmp_path)
    route_dir = tmp_path / "stats"
    route_dir.mkdir()
    (route_dir / "index.html").write_text("<html>stats</html>")

    response = static_files.serve_static("stats")

    assert response.path == route_dir / "index.html"
    assert response.media_type == "text/html; charset=utf-8"


def test_falls_back_to_root_shell_for_unknown_route(tmp_path, monkeypatch):
    _configure_public_dir(monkeypatch, tmp_path)
    (tmp_path / "index.html").write_text("<html>root shell</html>")

    response = static_files.serve_static("some/client-side/route")

    assert response.path == tmp_path / "index.html"


def test_root_path_serves_root_index(tmp_path, monkeypatch):
    _configure_public_dir(monkeypatch, tmp_path)
    (tmp_path / "index.html").write_text("<html>root shell</html>")

    response = static_files.serve_static("")

    assert response.path == tmp_path / "index.html"


def test_404_when_nothing_matches_and_no_shell_exists(tmp_path, monkeypatch):
    _configure_public_dir(monkeypatch, tmp_path)

    with pytest.raises(HTTPException) as exc_info:
        static_files.serve_static("anything")

    assert exc_info.value.status_code == 404


@pytest.mark.parametrize("traversal_path", ["../../../etc/passwd", "a/../../b"])
def test_path_traversal_is_rejected(tmp_path, monkeypatch, traversal_path):
    _configure_public_dir(monkeypatch, tmp_path)
    (tmp_path / "index.html").write_text("<html>root shell</html>")

    with pytest.raises(HTTPException) as exc_info:
        static_files.serve_static(traversal_path)

    assert exc_info.value.status_code == 403
