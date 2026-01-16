#!/usr/bin/env python3
"""
@file Генерация детерминированных OpenAPI снапшотов для FastAPI сервисов.

Зачем:
- генерация контрактов (OpenAPI -> Zod) должна быть воспроизводимой
- CI должен проверять, что снапшоты актуальны (без дрейфа)

Как работает:
- импортирует объект FastAPI `app` без запуска сервера
- вызывает `app.openapi()`
- записывает детерминированный JSON в `services/<service>/openapi.json`

Этот файл является частью contract pipeline:
FastAPI → OpenAPI snapshot → Zod generator → Frontend runtime validation
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI


REPO_ROOT = Path(__file__).resolve().parents[1]

# Не создаём __pycache__/.pyc при импорте сервисов (важно для чистоты репозитория).
sys.dont_write_bytecode = True


@dataclass(frozen=True)
class ServiceSpec:
    name: str
    service_dir: Path
    app_import: str  # например: "auth_src.main:app"


SERVICES: list[ServiceSpec] = [
    ServiceSpec(
        name="auth-service",
        service_dir=REPO_ROOT / "services" / "auth-service",
        app_import="auth_src.main:app",
    ),
    ServiceSpec(
        name="bots-service",
        service_dir=REPO_ROOT / "services" / "bots-service",
        app_import="bots_src.main:app",
    ),
    ServiceSpec(
        name="conversations-service",
        service_dir=REPO_ROOT / "services" / "conversations-service",
        app_import="conversations_src.main:app",
    ),
]


def _import_attr(import_str: str) -> Any:
    mod_path, attr = import_str.split(":")
    __import__(mod_path)
    mod = sys.modules[mod_path]
    return getattr(mod, attr)


def _dump_openapi(path: Path, openapi: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Детерминированное форматирование для диффов/CI.
    data = json.dumps(openapi, ensure_ascii=False, indent=2, sort_keys=True)
    path.write_text(data + "\n", encoding="utf-8")


def _normalize_openapi(openapi: dict[str, Any]) -> dict[str, Any]:
    """Нормализация OpenAPI перед сохранением.

    FastAPI иногда может менять порядок некоторых полей (например, servers/tags)
    в зависимости от версии/окружения. Сейчас `json.dumps(..., sort_keys=True)`
    достаточно, но этот хук оставляем для будущей стабилизации.
    """
    return openapi


def main() -> int:
    errors: list[str] = []
    for svc in SERVICES:
        if not svc.service_dir.exists():
            errors.append(f"{svc.name}: missing dir {svc.service_dir}")
            continue

        # Делаем модули сервиса импортируемыми (auth_src, bots_src, ...).
        sys.path.insert(0, str(svc.service_dir))
        try:
            app = _import_attr(svc.app_import)

            if not isinstance(app, FastAPI):
                raise TypeError(f"{svc.app_import} is not a FastAPI app")

            openapi = _normalize_openapi(app.openapi())
            out_path = svc.service_dir / "openapi.json"
            _dump_openapi(out_path, openapi)
            print(f"[ok] {svc.name}: wrote {out_path.relative_to(REPO_ROOT)}")
        except Exception as e:
            errors.append(f"{svc.name}: {e!r}")
        finally:
            # Убираем добавленный путь (best-effort).
            try:
                sys.path.remove(str(svc.service_dir))
            except ValueError:
                pass

    if errors:
        print("\n[error] OpenAPI snapshot generation failed:")
        for e in errors:
            print(f"- {e}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

