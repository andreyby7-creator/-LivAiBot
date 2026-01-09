import asyncio
import os
from collections.abc import Awaitable
from typing import cast

import asyncpg
import httpx
from dotenv import load_dotenv
from redis import asyncio as redis_async


def _load_env() -> None:
    # Предпочитаем локальный `.env` (пользователь создаёт его из `env.example`).
    # Если `.env` нет — читаем `env.example`, чтобы проверки были повторяемыми
    # из коробки.
    load_dotenv(".env", override=False)
    if not os.getenv("DATABASE_URL") and os.path.exists("env.example"):
        load_dotenv("env.example", override=False)


def _postgres_dsn_from_database_url(database_url: str) -> str:
    # SQLAlchemy async URL → asyncpg DSN
    return database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def check_postgres() -> None:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    dsn = _postgres_dsn_from_database_url(database_url)
    conn = await asyncpg.connect(dsn=dsn, timeout=5)
    try:
        val = await conn.fetchval("SELECT 1;")
        if val != 1:
            raise RuntimeError(f"Unexpected SELECT 1 result: {val!r}")
    finally:
        await conn.close()


async def check_redis() -> None:
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    r = redis_async.from_url(redis_url)
    try:
        # r.ping() returns a coroutine that resolves to bool
        ping_coro = cast(Awaitable[bool], r.ping())
        ok = await ping_coro
        if ok is not True:
            raise RuntimeError(f"Unexpected ping response: {ok!r}")
    finally:
        await r.aclose()


def check_clickhouse() -> None:
    host = os.getenv("CLICKHOUSE_HOST", "localhost")
    port = int(os.getenv("CLICKHOUSE_HTTP_PORT", "8123"))
    user = os.getenv("CLICKHOUSE_USER", "livai")
    password = os.getenv("CLICKHOUSE_PASSWORD", "livai")
    database = os.getenv("CLICKHOUSE_DATABASE", "livai")

    url = f"http://{host}:{port}/?user={user}&password={password}&database={database}&query=SELECT%201"

    with httpx.Client(timeout=5.0) as client:
        r = client.get(url)
        r.raise_for_status()
        if r.text.strip() != "1":
            raise RuntimeError(f"Unexpected SELECT 1 result: {r.text!r}")


def check_minio() -> None:
    endpoint = os.getenv("MINIO_ENDPOINT", "http://localhost:9000").rstrip("/")
    # MinIO exposes these health endpoints
    url = f"{endpoint}/minio/health/ready"
    with httpx.Client(timeout=5.0) as client:
        r = client.get(url)
        r.raise_for_status()


def check_qdrant() -> None:
    base = os.getenv("QDRANT_URL", "http://localhost:6333").rstrip("/")
    url = f"{base}/collections"
    with httpx.Client(timeout=5.0) as client:
        r = client.get(url)
        r.raise_for_status()


async def main() -> int:
    _load_env()

    failures: list[str] = []

    # Run async checks concurrently
    async_checks = [
        ("postgres", check_postgres()),
        ("redis", check_redis()),
    ]
    async_results = await asyncio.gather(
        *[coro for _, coro in async_checks], return_exceptions=True
    )
    for (name, _), result in zip(async_checks, async_results, strict=False):
        if isinstance(result, Exception):
            failures.append(f"{name}: {result}")
        else:
            print(f"[OK] {name}")

    for name, fn in [
        ("clickhouse", check_clickhouse),
        ("minio", check_minio),
        ("qdrant", check_qdrant),
    ]:
        try:
            fn()
            print(f"[OK] {name}")
        except Exception as e:
            failures.append(f"{name}: {e}")

    if failures:
        print("\n[FAIL]")
        for line in failures:
            print(f"- {line}")
        return 1

    print("\nAll infra checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
