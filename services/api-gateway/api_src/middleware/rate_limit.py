from __future__ import annotations

import time
from collections import defaultdict
from typing import Final

from fastapi.responses import JSONResponse
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from ..errors.http_errors import ErrorResponse


class RateLimitMiddleware:
    """Простейший in-memory rate-limiter (по IP) для dev/staging.

    Конфигурация по умолчанию:
      • max_requests = 100
      • window_seconds = 60

    Для production лучше вынести счётчики в Redis / Tarantool и т.п.
    """

    def __init__(
        self, app: ASGIApp, *, max_requests: int = 100, window_seconds: int = 60
    ) -> None:
        self.app: Final[ASGIApp] = app
        self.max_requests: Final[int] = max_requests
        self.window_seconds: Final[int] = window_seconds
        # Храним список timestamp-ов на каждый client_ip.
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:  # noqa: D401
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        trace_id = scope.setdefault("state", {}).get("trace_id")
        operation_id = scope["state"].get("operation_id")

        client_ip = self._get_client_ip(request)
        self._cleanup_old(client_ip)

        if len(self._requests[client_ip]) >= self.max_requests:
            await self._respond_json(
                JSONResponse(
                    status_code=429,
                    content=ErrorResponse(
                        code="RATE_LIMIT_EXCEEDED",
                        message=(
                            f"Превышен лимит: {self.max_requests} за "
                            f"{self.window_seconds} сек"
                        ),
                        trace_id=trace_id,
                        details={
                            "operation_id": operation_id,
                            "client_ip": client_ip,
                            "limit": self.max_requests,
                            "window": self.window_seconds,
                        },
                    ).model_dump(),
                ),
                send,
            )
            return

        # Регистрируем запрос и продолжаем цепочку.
        self._requests[client_ip].append(time.time())
        await self.app(scope, receive, send)

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    def _cleanup_old(self, client_ip: str) -> None:
        cutoff = time.time() - self.window_seconds
        self._requests[client_ip] = [t for t in self._requests[client_ip] if t > cutoff]

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        return request.client.host if request.client else "unknown"

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
            else bytes(response.body)
        )
        await send({"type": "http.response.body", "body": body})
