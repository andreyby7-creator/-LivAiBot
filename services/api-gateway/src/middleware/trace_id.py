from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class TraceIdMiddleware(BaseHTTPMiddleware):
    """Добавляет trace-id в запрос и ответ.

    - Читает входящий `X-Trace-Id` (если передан).
    - Иначе генерирует UUID.
    - Кладёт значение в `request.state.trace_id`.
    - Возвращает заголовок `X-Trace-Id` в ответе.

    Примечание по совместимости:
    - На переходный период принимаем и `X-Request-Id`, если клиент ещё не обновлён.
    """

    header_name = "X-Trace-Id"
    legacy_header_name = "X-Request-Id"

    async def dispatch(  # type: ignore[override]
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        trace_id = (
            request.headers.get(self.header_name)
            or request.headers.get(self.legacy_header_name)
            or str(uuid.uuid4())
        )
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers[self.header_name] = trace_id
        return response
