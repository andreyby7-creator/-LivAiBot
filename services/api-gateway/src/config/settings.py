from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", populate_by_name=True)

    app_env: str = Field(default="local", validation_alias="APP_ENV")

    # JWT (gateway валидирует access токены)
    jwt_secret: str = Field(
        default="dev-secret-change-me", validation_alias="JWT_SECRET"
    )
    jwt_issuer: str = Field(default="livai-auth-service", validation_alias="JWT_ISSUER")

    # URL'ы других сервисов (gateway будет проксировать запросы дальше по микросервисам)
    auth_service_url: str = Field(
        default="http://localhost:8001", validation_alias="AUTH_SERVICE_URL"
    )
    bots_service_url: str = Field(
        default="http://localhost:8002", validation_alias="BOTS_SERVICE_URL"
    )
    conversations_service_url: str = Field(
        default="http://localhost:8003", validation_alias="CONVERSATIONS_SERVICE_URL"
    )

    # CORS (позже ужесточим; для dev можно оставить `*`)
    cors_allow_origins: list[str] = ["*"]

    # Readiness checks (используется в /readyz)
    database_url: str | None = Field(default=None, validation_alias="DATABASE_URL")
    redis_url: str | None = Field(default=None, validation_alias="REDIS_URL")

    # Если включено — gateway будет пытаться проксировать /v1/* в downstream сервисы.
    # Для раннего этапа оставляем `False`, чтобы каркас работал без запущенных сервисов.
    proxy_enabled: bool = Field(default=False, validation_alias="PROXY_ENABLED")

    # Если включено — /readyz вернёт 503 при любой недоступности зависимостей.
    readiness_strict: bool = Field(default=True, validation_alias="READINESS_STRICT")
