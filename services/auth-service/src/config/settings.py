from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки auth-service.

    В MVP используем симметричную подпись JWT (HS256) и храним секрет в env.
    """

    model_config = SettingsConfigDict(extra="ignore", populate_by_name=True)

    app_env: str = Field(default="local", validation_alias="APP_ENV")

    database_url: str = Field(
        default="postgresql+asyncpg://livai:livai@localhost:5432/livai",
        validation_alias="DATABASE_URL",
    )

    # JWT
    jwt_secret: str = Field(
        default="dev-secret-change-me", validation_alias="JWT_SECRET"
    )
    jwt_issuer: str = Field(default="livai-auth-service", validation_alias="JWT_ISSUER")

    access_token_ttl_seconds: int = Field(
        default=15 * 60, validation_alias="ACCESS_TTL"
    )
    refresh_token_ttl_seconds: int = Field(
        default=30 * 24 * 60 * 60, validation_alias="REFRESH_TTL"
    )
