from __future__ import annotations

import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class OperationIdMiddleware:
    """ASGI-middleware для X-Operation-Id (auth-service)."""

    header_name: str = "X-Operation-Id"

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:  # noqa: D401
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        raw_bytes = self._get_header_bytes(scope, self.header_name)
        operation_id = self._coerce_uuid(raw_bytes.decode() if raw_bytes else None)
        scope.setdefault("state", {})["operation_id"] = operation_id

        async def send_wrapper(message: Message) -> None:
            if message.get("type") == "http.response.start":
                MutableHeaders(scope=message).append(self.header_name, operation_id)
            await send(message)

        await self.app(scope, receive, send_wrapper)

    # helpers
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
