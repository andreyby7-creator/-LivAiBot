from __future__ import annotations

import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class OperationIdMiddleware:
    """ASGI-middleware, добавляющее X-Operation-Id в запрос и ответ.

    Контракт:
    • Считывает входящий заголовок `X-Operation-Id` (UUID).
    • Если не передан или невалидный — генерирует новый UUID.
    • Сохраняет строковое значение в `scope['state'].operation_id`.
    • Всегда возвращает `X-Operation-Id` в ответе.
    """

    header_name: str = "X-Operation-Id"

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Обрабатываем только HTTP-запросы.
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Заголовки приходят как List[Tuple[bytes, bytes]].
        raw_bytes = self._get_header_bytes(scope, self.header_name)
        operation_id = self._coerce_uuid(raw_bytes.decode() if raw_bytes else None)

        # Кладём значение в state, чтобы downstream-приложение /
        # middleware могли использовать.
        scope.setdefault("state", {})["operation_id"] = operation_id

        async def send_wrapper(message: Message) -> None:
            # Добавляем заголовок на первом ответном сообщении.
            if message.get("type") == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.append(self.header_name, operation_id)
            await send(message)

        await self.app(scope, receive, send_wrapper)

    # ---------------------------------------------------------------------
    # helpers
    # ---------------------------------------------------------------------

    @staticmethod
    def _get_header_bytes(scope: Scope, name: str) -> bytes | None:
        name_bytes = name.lower().encode()
        for header_name, value in scope.get("headers", []):
            if header_name == name_bytes:
                return value
        return None

    @staticmethod
    def _coerce_uuid(value: str | None) -> str:
        if not value:
            return str(uuid.uuid4())
        try:
            return str(uuid.UUID(value))
        except Exception:
            return str(uuid.uuid4())
