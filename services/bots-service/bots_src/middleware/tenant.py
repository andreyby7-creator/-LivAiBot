from __future__ import annotations

import uuid

from fastapi.responses import JSONResponse
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from ..errors.http_errors import ErrorResponse


class TenantMiddleware:
    """ASGI-middleware, требующее X-Workspace-Id для /v1/* (bots-service)."""

    header_name: str = "X-Workspace-Id"

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:  # noqa: D401
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        path = request.url.path

        if path in {"/healthz", "/readyz"} or not path.startswith("/v1/"):
            await self.app(scope, receive, send)
            return

        raw = request.headers.get(self.header_name)
        try:
            workspace_id = uuid.UUID(raw) if raw else None
        except Exception:
            workspace_id = None

        if workspace_id is None:
            payload = ErrorResponse(
                code="UNAUTHORIZED", message="Нет X-Workspace-Id"
            ).model_dump()
            await self._respond_json(
                JSONResponse(status_code=401, content=payload), send
            )
            return

        scope.setdefault("state", {})["workspace_id"] = str(workspace_id)
        await self.app(scope, receive, send)

    # ------------------------------------------------------------------
    @staticmethod
    async def _respond_json(response: JSONResponse, send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": response.status_code,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        body: bytes = (
            response.body
            if isinstance(response.body, (bytes, bytearray))
            else str(response.body).encode()
        )
        await send({"type": "http.response.body", "body": body})
