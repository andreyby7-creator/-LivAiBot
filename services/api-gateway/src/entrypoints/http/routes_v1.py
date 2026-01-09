from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response
from starlette.requests import Request

from ...errors.http_errors import ErrorResponse

router = APIRouter(prefix="/v1")


@router.api_route(
    "/auth",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def v1_auth_proxy_root(request: Request) -> Response:
    """Прокси в auth-service (корневой роут без path)."""
    settings = request.app.state.settings
    return await _proxy_or_stub(
        request=request,
        upstream_base_url=settings.auth_service_url,
        proxy_enabled=settings.proxy_enabled,
    )


@router.api_route(
    "/auth/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def v1_auth_proxy(path: str, request: Request) -> Response:
    """Прокси в auth-service (или заглушка, если proxy отключён)."""
    settings = request.app.state.settings
    return await _proxy_or_stub(
        request=request,
        upstream_base_url=settings.auth_service_url,
        proxy_enabled=settings.proxy_enabled,
    )


@router.api_route(
    "/bots",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def v1_bots_proxy_root(request: Request) -> Response:
    """Прокси в bots-service (корневой роут без path).

    Нужен, чтобы избежать 307 редиректа `/v1/bots` → `/v1/bots/`.
    """
    settings = request.app.state.settings
    return await _proxy_or_stub(
        request=request,
        upstream_base_url=settings.bots_service_url,
        proxy_enabled=settings.proxy_enabled,
    )


@router.api_route(
    "/bots/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def v1_bots_proxy(path: str, request: Request) -> Response:
    """Прокси в bots-service (или заглушка, если proxy отключён)."""
    settings = request.app.state.settings
    return await _proxy_or_stub(
        request=request,
        upstream_base_url=settings.bots_service_url,
        proxy_enabled=settings.proxy_enabled,
    )


@router.api_route(
    "/conversations",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def v1_conversations_proxy_root(request: Request) -> Response:
    """Прокси в conversations-service (корневой роут без path)."""
    settings = request.app.state.settings
    return await _proxy_or_stub(
        request=request,
        upstream_base_url=settings.conversations_service_url,
        proxy_enabled=settings.proxy_enabled,
    )


@router.api_route(
    "/conversations/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def v1_conversations_proxy(path: str, request: Request) -> Response:
    """Прокси в conversations-service (или заглушка, если proxy отключён)."""
    settings = request.app.state.settings
    return await _proxy_or_stub(
        request=request,
        upstream_base_url=settings.conversations_service_url,
        proxy_enabled=settings.proxy_enabled,
    )


async def _proxy_or_stub(
    *,
    request: Request,
    upstream_base_url: str,
    proxy_enabled: bool,
) -> Response:
    trace_id = getattr(request.state, "trace_id", None)
    operation_id = getattr(request.state, "operation_id", None)

    if not proxy_enabled:
        payload = ErrorResponse(
            code="NOT_IMPLEMENTED",
            message="Маршрут подключён в gateway, но проксирование отключено",
            trace_id=trace_id,
            details={"operation_id": operation_id},
        ).model_dump()
        return JSONResponse(status_code=501, content=payload)

    upstream_url = _build_upstream_url(
        request=request, upstream_base_url=upstream_base_url
    )
    headers = _forward_headers(request.headers)
    _inject_context_headers(request, headers)
    body = await request.body()

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.request(
                method=request.method,
                url=upstream_url,
                params=request.query_params,
                headers=headers,
                content=body,
            )
    except Exception as e:
        payload = ErrorResponse(
            code="DOWNSTREAM_UNAVAILABLE",
            message="Downstream сервис недоступен",
            trace_id=trace_id,
            details={
                "operation_id": operation_id,
                "upstream": upstream_base_url,
                "error": str(e),
            },
        ).model_dump()
        return JSONResponse(status_code=502, content=payload)

    content_type = resp.headers.get("content-type")
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=content_type,
    )


def _build_upstream_url(*, request: Request, upstream_base_url: str) -> str:
    """Собирает URL для downstream, сохраняя путь `/v1/...`."""
    base = upstream_base_url.rstrip("/")
    path = request.url.path
    return f"{base}{path}"


def _forward_headers(headers: Any) -> dict[str, str]:
    """Отбирает и нормализует заголовки для проксирования."""
    hop_by_hop = {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "host",
        "content-length",
    }
    result: dict[str, str] = {}
    for k, v in headers.items():
        if k.lower() in hop_by_hop:
            continue
        result[k] = v
    return result


def _inject_context_headers(request: Request, headers: dict[str, str]) -> None:
    """Пробрасывает контекст gateway в downstream заголовками."""
    trace_id = getattr(request.state, "trace_id", None)
    operation_id = getattr(request.state, "operation_id", None)
    user_id = getattr(request.state, "user_id", None)
    workspace_id = getattr(request.state, "workspace_id", None)

    if trace_id:
        headers["X-Trace-Id"] = str(trace_id)
    if operation_id:
        headers["X-Operation-Id"] = str(operation_id)
    if user_id:
        headers["X-User-Id"] = str(user_id)
    if workspace_id:
        headers["X-Workspace-Id"] = str(workspace_id)
