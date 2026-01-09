from __future__ import annotations

import uuid

from fastapi.responses import JSONResponse
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from ..errors.http_errors import ErrorResponse
from ..security.jwt import JwtError, decode_and_verify


class AuthMiddleware:
    """ASGI-middleware, валидирующее access-JWT и добавляющее tenant-context.

    Публичные маршруты (не требуют токен):
      • `/v1/auth/*`
      • `/healthz`, `/readyz`, `/openapi.json`, `/docs*`, `/redoc`

    Для остальных `/v1/*`:
      • Проверяем заголовок `Authorization: Bearer <token>`.
      • Декодируем, валидируем claims.
      • Сохраняем `user_id`, `workspace_id` в `scope['state']`.
    """

    public_paths: set[str] = {
        "/healthz",
        "/readyz",
        "/openapi.json",
        "/docs",
        "/docs/oauth2-redirect",
        "/redoc",
    }

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:  # noqa: D401
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        path = request.url.path

        # Пропускаем публичные пути.
        if self._is_public_path(path):
            await self.app(scope, receive, send)
            return

        # Требуется токен.
        maybe_error = self._require_access_token(request, scope)
        if maybe_error is not None:
            await self._respond_json(maybe_error, send)
            return

        await self.app(scope, receive, send)

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    def _is_public_path(self, path: str) -> bool:
        if path in self.public_paths:
            return True
        if path.startswith("/v1/auth/"):
            return True
        return False

    def _require_access_token(
        self, request: Request, scope: Scope
    ) -> JSONResponse | None:
        settings = request.app.state.settings  # type: ignore[attr-defined]
        trace_id = scope.setdefault("state", {}).get("trace_id")
        operation_id = scope["state"].get("operation_id")

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.lower().startswith("bearer "):
            return self._unauthorized("Нет токена", trace_id, operation_id)

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = decode_and_verify(
                token,
                secret=settings.jwt_secret,  # type: ignore[attr-defined]
                issuer=settings.jwt_issuer,  # type: ignore[attr-defined]
                expected_token_type="access",
            )
        except JwtError:
            return self._unauthorized("Неверный токен", trace_id, operation_id)

        try:
            user_id = uuid.UUID(payload["sub"])
            workspace_id = uuid.UUID(payload["workspace_id"])
        except Exception:
            return self._unauthorized("Неверные claims токена", trace_id, operation_id)

        scope["state"].update(
            {
                "user_id": str(user_id),
                "workspace_id": str(workspace_id),
            }
        )
        return None

    @staticmethod
    def _unauthorized(
        message: str, trace_id: str | None, operation_id: str | None
    ) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content=ErrorResponse(
                code="UNAUTHORIZED",
                message=message,
                trace_id=trace_id,
                details={"operation_id": operation_id},
            ).model_dump(),
        )

    @staticmethod
    async def _respond_json(response: JSONResponse, send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": response.status_code,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        body = (
            response.body
            if isinstance(response.body, (bytes, bytearray))
            else bytes(response.body)
        )
        await send({"type": "http.response.body", "body": body})
