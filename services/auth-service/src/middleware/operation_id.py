from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class OperationIdMiddleware(BaseHTTPMiddleware):
    """Добавляет operation_id в запрос и ответ.

    Контракт:
    - Входящий заголовок: `X-Operation-Id` (UUID).
    - Если не передан или невалидный — генерируем новый UUID.
    - Значение кладём в `request.state.operation_id`.
    - Всегда возвращаем `X-Operation-Id` в ответе.
    """

    header_name = "X-Operation-Id"

    async def dispatch(  # type: ignore[override]
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        raw = request.headers.get(self.header_name)
        operation_id = self._coerce_uuid(raw)
        request.state.operation_id = operation_id

        response = await call_next(request)
        response.headers[self.header_name] = operation_id
        return response

    @staticmethod
    def _coerce_uuid(value: str | None) -> str:
        if not value:
            return str(uuid.uuid4())
        try:
            return str(uuid.UUID(value))
        except Exception:
            return str(uuid.uuid4())
