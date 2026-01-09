from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..errors.http_errors import ErrorResponse


class TenantMiddleware(BaseHTTPMiddleware):
    """Требует tenant context (workspace_id) для всех /v1/* маршрутов.

    Ожидаем заголовок: `X-Workspace-Id: <uuid>`.
    """

    header_name = "X-Workspace-Id"

    async def dispatch(  # type: ignore[override]
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.method.upper() == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if path in {"/healthz", "/readyz"}:
            return await call_next(request)

        if path.startswith("/v1/"):
            raw = request.headers.get(self.header_name)
            if not raw:
                return self._error(request, message="Нет X-Workspace-Id")
            try:
                workspace_id = uuid.UUID(raw)
            except Exception:
                return self._error(request, message="Некорректный X-Workspace-Id")

            request.state.workspace_id = str(workspace_id)

        return await call_next(request)

    @staticmethod
    def _error(request: Request, *, message: str) -> JSONResponse:
        trace_id = getattr(request.state, "trace_id", None)
        payload = ErrorResponse(
            code="UNAUTHORIZED", message=message, trace_id=trace_id
        ).model_dump()
        return JSONResponse(status_code=401, content=payload)
