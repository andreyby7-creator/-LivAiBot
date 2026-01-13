"""Общие утилиты для retry и dedupe операций."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conversations_src.adapters.db.llm_turns_model import LLMTurn
from conversations_src.adapters.db.models import JobQueue, WebhookEvent


async def retry_async(
    func: Callable[[], Any],
    retries: int = 3,
    backoff_in_seconds: float = 1.0,
    max_backoff: float = 10.0,
) -> Any:
    """Выполняет асинхронную функцию с retry и экспоненциальной задержкой."""
    for attempt in range(retries):
        try:
            return await func()
        except Exception:
            if attempt == retries - 1:
                raise
            delay = min(backoff_in_seconds * 2**attempt, max_backoff)
            await asyncio.sleep(delay)


async def is_operation_processed(session: AsyncSession, operation_id: str) -> bool:
    """Проверяем, была ли операция уже обработана во всех таблицах с operation_id."""
    # Проверяем llm_turns (operation_id хранится как string)
    result = await session.execute(
        select(LLMTurn).where(LLMTurn.operation_id == operation_id)
    )
    if result.scalar_one_or_none() is not None:
        return True

    try:
        # Конвертируем operation_id в UUID для других таблиц
        operation_uuid = uuid.UUID(operation_id)
    except ValueError:
        # Если operation_id не является валидным UUID, проверяем только llm_turns
        return False

    # Проверяем webhook_events (только успешно обработанные)
    result = await session.execute(
        select(WebhookEvent).where(
            WebhookEvent.operation_id == operation_uuid,
            WebhookEvent.status == "processed",
        )
    )
    if result.scalar_one_or_none() is not None:
        return True

    # Проверяем job_queue (только успешно завершенные)
    result = await session.execute(
        select(JobQueue).where(
            JobQueue.operation_id == operation_uuid, JobQueue.status == "completed"
        )
    )
    return result.scalar_one_or_none() is not None


async def process_webhook_event(event, session):
    """Processor для webhook_events."""
    if await is_operation_processed(session, event.operation_id):
        return

    try:
        await retry_async(lambda: handle_event(event))
    except Exception as e:
        # отправляем в DLQ с причиной ошибки
        await add_to_dlq(session, event, str(e))


async def process_job(job, session):
    """Processor для job_queue."""
    if await is_operation_processed(session, job.operation_id):
        return

    try:
        await retry_async(lambda: execute_job(job))
    except Exception as e:
        await add_to_dlq(session, job, str(e))


async def handle_event(event):
    """Обработать webhook событие."""
    # Заглушка для обработки события
    pass


async def execute_job(job):
    """Выполнить задачу."""
    # Заглушка для выполнения задачи
    pass


async def add_to_dlq(session, item, error_message: str):
    """Отправить элемент в DLQ."""
    # Заглушка для отправки в DLQ
    pass
