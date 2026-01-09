from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

from src.adapters.db.session import create_sessionmaker
from src.config.settings import Settings
from src.entrypoints.http.routes_auth import router as auth_router
from src.entrypoints.http.routes_health import router as health_router
from src.errors.http_errors import ErrorResponse
from src.middleware.operation_id import OperationIdMiddleware
from src.middleware.trace_id import TraceIdMiddleware


async def validation_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Единый обработчик ошибок валидации (422)."""
    assert isinstance(exc, RequestValidationError)
    trace_id = getattr(request.state, "trace_id", None)
    operation_id = getattr(request.state, "operation_id", None)
    payload = ErrorResponse(
        code="VALIDATION_ERROR",
        message="Ошибка валидации запроса",
        trace_id=trace_id,
        details={
            "operation_id": operation_id,
            "errors": exc.errors(),
        },
    ).model_dump()
    return JSONResponse(status_code=422, content=payload)


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Единый обработчик HTTP ошибок (включая 404/401/403)."""
    assert isinstance(exc, StarletteHTTPException)
    trace_id = getattr(request.state, "trace_id", None)
    operation_id = getattr(request.state, "operation_id", None)

    code = f"HTTP_{exc.status_code}"
    message = "Ошибка запроса"
    details: dict | None = {"operation_id": operation_id}

    if isinstance(exc.detail, dict):
        code = str(exc.detail.get("code", code))
        message = str(exc.detail.get("message", message))
        extra_details = exc.detail.get("details")
        if isinstance(extra_details, dict):
            details = {**(details or {}), **extra_details}
    elif isinstance(exc.detail, str):
        message = exc.detail
    else:
        details = {**(details or {}), "detail": exc.detail}

    payload = ErrorResponse(
        code=code, message=message, trace_id=trace_id, details=details
    ).model_dump()
    return JSONResponse(status_code=exc.status_code, content=payload)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Единый обработчик неожиданных ошибок (500)."""
    trace_id = getattr(request.state, "trace_id", None)
    operation_id = getattr(request.state, "operation_id", None)
    payload = ErrorResponse(
        code="INTERNAL_ERROR",
        message="Внутренняя ошибка сервера",
        trace_id=trace_id,
        details={"operation_id": operation_id},
    ).model_dump()
    return JSONResponse(status_code=500, content=payload)


def create_app(settings: Settings) -> FastAPI:
    """Создать FastAPI приложение."""
    app = FastAPI(title="LivAi Auth Service", version="0.1.0")
    app.state.settings = settings
    app.state.db_sessionmaker = create_sessionmaker(settings)

    app.add_middleware(TraceIdMiddleware)
    app.add_middleware(OperationIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    app.include_router(health_router, tags=["health"])
    # Дублируем health/ready под `/v1/auth/*`,
    # чтобы их можно было дергать через gateway-прокси.
    app.include_router(health_router, prefix="/v1/auth", tags=["health"])
    app.include_router(auth_router)
    return app


def _load_settings() -> Settings:
    """Загрузить настройки из env (+ .env из корня репозитория, если есть)."""
    try:
        from dotenv import load_dotenv

        repo_root = _find_repo_root()
        env_path = repo_root / ".env"
        if env_path.exists():
            load_dotenv(env_path, override=False)
    except Exception:
        pass
    return Settings()


def _find_repo_root() -> Path:
    """Найти корень репозитория (где лежит `env.example`)."""
    here = Path(__file__).resolve()
    for parent in [here] + list(here.parents):
        if (parent / "env.example").exists():
            return parent
    return Path(os.getcwd()).resolve()


app = create_app(_load_settings())
