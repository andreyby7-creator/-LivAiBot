from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from auth_src.adapters.db import models  # noqa: F401  # важно для регистрации моделей
from auth_src.adapters.db.base import Base

# Alembic Config object, provides access to values in alembic.ini
config = context.config

# Интерпретируем конфиг логирования из alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _load_env() -> None:
    """Подгружает переменные окружения из `.env` (или `env.example` как fallback).

    Нужно, чтобы `alembic upgrade head` работал “из коробки” в локальной разработке,
    без ручного экспорта `DATABASE_URL`.
    """
    try:
        from dotenv import load_dotenv

        repo_root = _find_repo_root()
        env_path = repo_root / ".env"
        if env_path.exists():
            load_dotenv(env_path, override=False)
            return

        # fallback: используем пример (без секретов), чтобы миграции не ломались
        # из-за отсутствия env
        example_path = repo_root / "env.example"
        if example_path.exists():
            load_dotenv(example_path, override=False)
    except Exception:
        # Если python-dotenv недоступен — работаем только с env процесса.
        pass


def _find_repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in [here] + list(here.parents):
        if (parent / "env.example").exists():
            return parent
    return Path.cwd().resolve()


def _get_database_url() -> str:
    _load_env()
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL не задан для миграций")
    # Alembic/SQLAlchemy ожидают реальный async URL (мы его и используем).
    return url


def run_migrations_offline() -> None:
    """Запуск миграций в offline режиме."""
    url = _get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection, target_metadata=target_metadata, compare_type=True
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Запуск миграций в online режиме (async engine)."""
    alembic_config = config.get_section(config.config_ini_section, {})
    alembic_config["sqlalchemy.url"] = _get_database_url()

    connectable = async_engine_from_config(
        alembic_config,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
