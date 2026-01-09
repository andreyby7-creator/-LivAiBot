from __future__ import annotations

import asyncio

import asyncpg
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from redis import asyncio as redis_async
from starlette.requests import Request

router = APIRouter()


@router.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(request: Request) -> JSONResponse:
    """Проверка готовности (зависимости доступны).

    Важно: `/healthz` отвечает только за “процесс жив”.
    `/readyz` — за доступность внешних зависимостей (Postgres/Redis и т.п.).
    """
    settings = request.app.state.settings

    checks: dict[str, dict] = {}
    postgres_ok = await _check_postgres(
        settings.database_url, strict=settings.readiness_strict
    )
    checks["postgres"] = postgres_ok

    redis_ok = await _check_redis(settings.redis_url, strict=settings.readiness_strict)
    checks["redis"] = redis_ok

    ok = all(v.get("ok") is True for v in checks.values())
    status_code = 200 if ok else 503
    payload = {"status": "ready" if ok else "not_ready", "checks": checks}
    return JSONResponse(status_code=status_code, content=payload)


async def _check_postgres(database_url: str | None, strict: bool) -> dict:
    if not database_url:
        return {"ok": (not strict), "error": "DATABASE_URL не задан"}

    dsn = database_url.replace("postgresql+asyncpg://", "postgresql://")
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn=dsn), timeout=2.0)
        try:
            await conn.execute("SELECT 1")
        finally:
            await conn.close()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def _check_redis(redis_url: str | None, strict: bool) -> dict:
    if not redis_url:
        return {"ok": (not strict), "error": "REDIS_URL не задан"}

    client = redis_async.from_url(
        redis_url,
        socket_connect_timeout=1.5,
        socket_timeout=1.5,
        decode_responses=False,
    )
    try:
        ping_result = client.ping()
        if isinstance(ping_result, bool):
            ok = ping_result
        else:
            ok = await asyncio.wait_for(ping_result, timeout=2.0)
        if not ok:
            return {"ok": False, "error": "Redis ping вернул False"}
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        try:
            await client.aclose()
        except Exception:
            pass
