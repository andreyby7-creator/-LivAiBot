from __future__ import annotations

import uuid

from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class TraceIdMiddleware:
    """ASGI-middleware, добавляющее X-Trace-Id
    (и поддерживающее X-Request-Id как legacy).

    Контракт:
    • Читает входящий `X-Trace-Id` или `X-Request-Id`.
    • Если нет — генерирует новый UUID4.
    • Сохраняет значение в `scope['state'].trace_id`.
    • Всегда возвращает `X-Trace-Id` заголовком ответа.
    """

    header_name: str = "X-Trace-Id"
    legacy_header_name: str = "X-Request-Id"

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:  # noqa: D401
        # Обрабатываем только HTTP-запросы.
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        trace_id = (
            request.headers.get(self.header_name)
            or request.headers.get(self.legacy_header_name)
            or str(uuid.uuid4())
        )

        # Сохраняем в state.
        scope.setdefault("state", {})["trace_id"] = trace_id

        async def send_wrapper(message: Message) -> None:  # noqa: ANN001 – strict ASGI type
            if message.get("type") == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.append(self.header_name, trace_id)
            await send(message)

        await self.app(scope, receive, send_wrapper)
