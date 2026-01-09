from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

from conversations_src.adapters.db.session import create_sessionmaker
from conversations_src.config.settings import Settings
from conversations_src.entrypoints.http.routes_conversations import (
    router as conversations_router,
)
from conversations_src.entrypoints.http.routes_health import router as health_router
from conversations_src.errors.http_errors import ErrorResponse
from conversations_src.middleware.dedupe import DedupeMiddleware
from conversations_src.middleware.tenant import TenantMiddleware


async def validation_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    trace_id = getattr(request.state, "trace_id", None)
    payload = ErrorResponse(
        code="VALIDATION_ERROR",
        message="Ошибка валидации запроса",
        trace_id=trace_id,
        details={"errors": exc.errors()},
    ).model_dump()
    return JSONResponse(status_code=422, content=payload)


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    trace_id = getattr(request.state, "trace_id", None)

    code = f"HTTP_{exc.status_code}"
    message = "Ошибка запроса"
    details: dict | None = None

    if isinstance(exc.detail, dict):
        code = str(exc.detail.get("code", code))
        message = str(exc.detail.get("message", message))
        extra_details = exc.detail.get("details")
        if isinstance(extra_details, dict):
            details = extra_details
    elif isinstance(exc.detail, str):
        message = exc.detail
    else:
        details = {"detail": exc.detail}

    payload = ErrorResponse(
        code=code, message=message, trace_id=trace_id, details=details
    ).model_dump()
    return JSONResponse(status_code=exc.status_code, content=payload)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    trace_id = getattr(request.state, "trace_id", None)
    payload = ErrorResponse(
        code="INTERNAL_ERROR", message="Внутренняя ошибка сервера", trace_id=trace_id
    ).model_dump()
    return JSONResponse(status_code=500, content=payload)


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(title="LivAi Conversations Service", version="0.1.0")
    app.state.settings = settings
    app.state.db_sessionmaker = create_sessionmaker(settings)

    app.add_middleware(DedupeMiddleware)
    app.add_middleware(TenantMiddleware)
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
    # Чтобы health можно было дёргать через gateway-прокси
    app.include_router(health_router, prefix="/v1/conversations", tags=["health"])
    app.include_router(conversations_router)
    return app


def _load_settings() -> Settings:
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
    here = Path(__file__).resolve()
    for parent in [here] + list(here.parents):
        if (parent / "env.example").exists():
            return parent
    return Path(os.getcwd()).resolve()


app = create_app(_load_settings())
