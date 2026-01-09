from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..errors.http_errors import ErrorResponse
from ..security.jwt import JwtError, decode_and_verify


class AuthMiddleware(BaseHTTPMiddleware):
    """Проверяет access JWT и добавляет tenant context в `request.state`.

    - Валидирует `Authorization: Bearer <token>` для защищённых маршрутов.
    - Извлекает `user_id` и `workspace_id` и кладёт их в:
      - `request.state.user_id`
      - `request.state.workspace_id`

    Примечание:
    - `/v1/auth/*` и health/ready — публичные.
    - Все остальные `/v1/*` считаем защищёнными (до появления более тонкой политики).
    """

    async def dispatch(  # type: ignore[override]
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.method.upper() == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if self._is_public_path(path):
            return await call_next(request)

        if path.startswith("/v1/"):
            maybe_error = self._require_access_token(request)
            if maybe_error is not None:
                return maybe_error

        return await call_next(request)

    @staticmethod
    def _is_public_path(path: str) -> bool:
        if path in {
            "/healthz",
            "/readyz",
            "/openapi.json",
            "/docs",
            "/docs/oauth2-redirect",
            "/redoc",
        }:
            return True
        if path.startswith("/v1/auth/"):
            return True
        return False

    @staticmethod
    def _require_access_token(request: Request) -> Response | None:
        settings = request.app.state.settings
        trace_id = getattr(request.state, "trace_id", None)
        operation_id = getattr(request.state, "operation_id", None)

        auth = request.headers.get("Authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return JSONResponse(
                status_code=401,
                content=ErrorResponse(
                    code="UNAUTHORIZED",
                    message="Нет токена",
                    trace_id=trace_id,
                    details={"operation_id": operation_id},
                ).model_dump(),
            )

        token = auth.split(" ", 1)[1].strip()
        try:
            payload = decode_and_verify(
                token,
                secret=settings.jwt_secret,
                issuer=settings.jwt_issuer,
                expected_token_type="access",
            )
        except JwtError:
            return JSONResponse(
                status_code=401,
                content=ErrorResponse(
                    code="UNAUTHORIZED",
                    message="Неверный токен",
                    trace_id=trace_id,
                    details={"operation_id": operation_id},
                ).model_dump(),
            )

        try:
            user_id = uuid.UUID(payload["sub"])
            workspace_id = uuid.UUID(payload["workspace_id"])
        except Exception:
            return JSONResponse(
                status_code=401,
                content=ErrorResponse(
                    code="UNAUTHORIZED",
                    message="Неверные claims токена",
                    trace_id=trace_id,
                    details={"operation_id": operation_id},
                ).model_dump(),
            )

        request.state.user_id = str(user_id)
        request.state.workspace_id = str(workspace_id)
        return None
