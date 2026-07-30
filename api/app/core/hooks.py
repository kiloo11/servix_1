"""Tiny indirection so app/core/records.py (assets/payments) can trigger a
notification-schedule recompute without importing the scheduler module
directly — avoids a circular import (scheduler needs DB/records too). The
scheduler module registers the real implementation at startup; until then
it's a no-op, same as if notifications were simply unconfigured.

`on_asset_changed` is a stable function, not a plain variable: records.py/
data.py do `from app.core.hooks import on_asset_changed` at their own
module load time, which binds that name to whatever object it pointed to
right then. If registration reassigned a module-level variable instead,
those already-bound imports would keep calling the original no-op forever.
Keeping `on_asset_changed` itself constant and mutating what it delegates
to *inside* the function body is what makes late registration visible to
early importers.
"""

from __future__ import annotations

from typing import Callable

_impl: Callable[[], None] = lambda: None


def register_on_asset_changed(fn: Callable[[], None]) -> None:
    global _impl
    _impl = fn


def on_asset_changed() -> None:
    _impl()
