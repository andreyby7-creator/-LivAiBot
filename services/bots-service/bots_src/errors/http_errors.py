from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Единый формат ошибки для HTTP API."""

    code: str
    message: str
    trace_id: str | None = None
    details: dict[str, Any] | None = None
