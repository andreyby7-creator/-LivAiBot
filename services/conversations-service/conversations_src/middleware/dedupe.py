from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..errors.http_errors import ErrorResponse


class DedupeMiddleware(BaseHTTPMiddleware):
    """Middleware для дедупликации операций по operation_id.

    Предотвращает повторную обработку одного и того же operation_id
    в течение заданного времени (TTL).
    """

    def __init__(self, app, ttl_seconds: int = 300):  # 5 минут по умолчанию
        super().__init__(app)
        self.ttl_seconds = ttl_seconds
        # In-memory хранилище обработанных operation_id
        # В продакшене заменить на Redis
        self.processed_operations: dict[str, float] = {}

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        operation_id = getattr(request.state, "operation_id", None)

        if operation_id:
            operation_key = str(operation_id)

            # Проверяем, не обрабатывался ли уже этот operation_id
            if operation_key in self.processed_operations:
                processed_at = self.processed_operations[operation_key]
                current_time = (
                    request.app.state.settings.current_time()
                    if hasattr(request.app.state.settings, "current_time")
                    else None
                )

                # Если операция была обработана недавно, возвращаем успех
                if current_time and (current_time - processed_at) < self.ttl_seconds:
                    trace_id = getattr(request.state, "trace_id", None)
                    payload = ErrorResponse(
                        code="OPERATION_ALREADY_PROCESSED",
                        message="Операция уже была обработана ранее",
                        trace_id=trace_id,
                        details={
                            "operation_id": operation_id,
                            "processed_at": processed_at,
                        },
                    ).model_dump()
                    return JSONResponse(status_code=200, content=payload)

            # Помечаем операцию как обрабатываемую
            self.processed_operations[operation_key] = (
                request.app.state.settings.current_time()
                if hasattr(request.app.state.settings, "current_time")
                else 0
            )

            # Очищаем старые записи (простая garbage collection)
            self._cleanup_old_operations()

        response = await call_next(request)
        return response

    def _cleanup_old_operations(self) -> None:
        """Удаляет старые записи из кэша."""
        current_time = 0  # В реальном коде использовать time.time()
        cutoff_time = current_time - self.ttl_seconds

        keys_to_remove = [
            key
            for key, timestamp in self.processed_operations.items()
            if timestamp < cutoff_time
        ]

        for key in keys_to_remove:
            del self.processed_operations[key]
