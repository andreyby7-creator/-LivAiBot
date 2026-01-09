"""Пример Settings для Python-сервисов (Pydantic v2).

Идея:
- в корне репозитория есть `env.example`, из которого разработчик делает `.env`
- каждый сервис читает нужные ему переменные окружения

В реальном сервисе файл обычно лежит в `services/<name>/src/config/settings.py`.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки сервиса из переменных окружения."""

    model_config = SettingsConfigDict(extra="ignore")

    app_env: str = "local"

    # Postgres (SQLAlchemy async)
    database_url: str = "postgresql+asyncpg://livai:livai@localhost:5432/livai"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # ClickHouse
    clickhouse_host: str = "localhost"
    clickhouse_http_port: int = 8123
    clickhouse_user: str = "livai"
    clickhouse_password: str = "livai"
    clickhouse_database: str = "livai"

    # MinIO (S3-compatible)
    minio_endpoint: str = "http://localhost:9000"
    minio_access_key: str = "livai"
    minio_secret_key: str = "livaiadmin123"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"

