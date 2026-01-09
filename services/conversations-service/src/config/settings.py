from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки conversations-service."""

    model_config = SettingsConfigDict(extra="ignore", populate_by_name=True)

    app_env: str = Field(default="local", validation_alias="APP_ENV")

    database_url: str = Field(
        default="postgresql+asyncpg://livai:livai@localhost:5432/livai",
        validation_alias="DATABASE_URL",
    )
