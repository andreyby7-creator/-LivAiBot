from __future__ import annotations

import uuid

from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class TraceIdMiddleware:
    """ASGI-middleware для X-Trace-Id (auth-service)."""

    header_name: str = "X-Trace-Id"
    legacy_header_name: str = "X-Request-Id"

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:  # noqa: D401
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        trace_id = (
            request.headers.get(self.header_name)
            or request.headers.get(self.legacy_header_name)
            or str(uuid.uuid4())
        )
        scope.setdefault("state", {})["trace_id"] = trace_id

        async def send_wrapper(message: Message) -> None:
            if message.get("type") == "http.response.start":
                MutableHeaders(scope=message).append(self.header_name, trace_id)
            await send(message)

        await self.app(scope, receive, send_wrapper)
