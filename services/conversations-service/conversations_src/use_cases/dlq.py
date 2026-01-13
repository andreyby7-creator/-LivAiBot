from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..adapters.db.models import DeadLetterQueue
from ..config.settings import Settings

# JSON-compatible types for payload data
JSONValue = str | int | float | bool | None | list["JSONValue"] | dict[str, "JSONValue"]
JSONObject = dict[str, JSONValue]

# More permissive type for statistics that may include None values
StatsDict = dict[str, JSONValue]


class ExponentialBackoff:
    """Экспоненциальный backoff для retry механизма."""

    def __init__(
        self,
        base_delay_minutes: int = 1,
        max_delay_minutes: int = 60 * 24,  # 24 часа максимум
        multiplier: float = 2.0,
        jitter: bool = True,
    ):
        self.base_delay_minutes = base_delay_minutes
        self.max_delay_minutes = max_delay_minutes
        self.multiplier = multiplier
        self.jitter = jitter

    def calculate_delay(self, attempt: int) -> int:
        """Рассчитать задержку для заданной попытки (в минутах)."""
        if attempt <= 0:
            return 0

        # Экспоненциальная задержка: base_delay * (multiplier ^ (attempt - 1))
        delay = self.base_delay_minutes * (self.multiplier ** (attempt - 1))

        # Ограничиваем максимальной задержкой
        delay = min(delay, self.max_delay_minutes)

        # Добавляем jitter (±25% случайной вариации)
        if self.jitter:
            import random

            jitter_factor = random.uniform(0.75, 1.25)
            delay = int(delay * jitter_factor)

        return max(1, int(delay))  # Минимум 1 минута


class DLQService:
    """Сервис для работы с Dead Letter Queue (DLQ).

    DLQ используется для хранения сообщений, которые не удалось обработать
    после всех попыток retry.
    """

    def __init__(self, db_session: AsyncSession, settings: Settings):
        self.db_session = db_session
        self.settings = settings
        self.backoff = ExponentialBackoff()

    async def add_to_dlq(
        self,
        workspace_id: uuid.UUID,
        operation_id: uuid.UUID | None,
        event_type: str,
        payload: JSONObject,
        error_message: str,
        error_code: str | None = None,
        original_table: str | None = None,
        original_id: uuid.UUID | None = None,
        retry_count: int = 0,
        max_retries: int = 3,
    ) -> uuid.UUID:
        """Добавить сообщение в DLQ."""

        dlq_entry = DeadLetterQueue(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            operation_id=operation_id,
            original_table=original_table,
            original_id=original_id,
            event_type=event_type,
            payload=payload,
            error_message=error_message,
            error_code=error_code,
            retry_count=retry_count,
            max_retries=max_retries,
            created_at=datetime.now(timezone.utc),
            last_attempt_at=datetime.now(timezone.utc),
        )

        self.db_session.add(dlq_entry)
        await self.db_session.commit()

        return dlq_entry.id

    async def get_pending_retry(self, limit: int = 10) -> list[DeadLetterQueue]:
        """Получить сообщения из DLQ, готовые для повторной попытки."""

        now = datetime.now(timezone.utc)
        stmt = (
            select(DeadLetterQueue)
            .where(
                DeadLetterQueue.retry_count < DeadLetterQueue.max_retries,
                (DeadLetterQueue.next_retry_at.is_(None))
                | (DeadLetterQueue.next_retry_at <= now),
            )
            .limit(limit)
        )

        result = await self.db_session.execute(stmt)
        return list(result.scalars().all())

    async def mark_retry_attempt(
        self,
        dlq_id: uuid.UUID,
        success: bool,
        error_message: str | None = None,
        next_retry_delay_minutes: int | None = None,
    ) -> None:
        """Отметить попытку retry для DLQ записи."""

        stmt = select(DeadLetterQueue).where(DeadLetterQueue.id == dlq_id)
        result = await self.db_session.execute(stmt)
        dlq_entry = result.scalar_one_or_none()

        if not dlq_entry:
            return

        dlq_entry.retry_count += 1
        dlq_entry.last_attempt_at = datetime.now(timezone.utc)

        if success:
            # Успешно обработано - удаляем из DLQ
            await self.db_session.delete(dlq_entry)
        else:
            # Неудача - планируем следующий retry
            if dlq_entry.retry_count < dlq_entry.max_retries:
                # Используем экспоненциальный backoff если задержка не указана явно
                if next_retry_delay_minutes is None:
                    next_retry_delay_minutes = self.backoff.calculate_delay(
                        dlq_entry.retry_count
                    )

                dlq_entry.next_retry_at = datetime.now(timezone.utc) + timedelta(
                    minutes=next_retry_delay_minutes
                )
                dlq_entry.error_message = error_message or dlq_entry.error_message
            # Если превысили max_retries, оставляем в DLQ для ручной обработки

        await self.db_session.commit()

    async def get_dlq_stats(self, workspace_id: uuid.UUID | None = None) -> JSONObject:
        """Получить статистику DLQ."""

        # В реальной реализации здесь будут запросы для подсчета статистики
        # Пока возвращаем заглушку, но используем workspace_id для
        # потенциальной фильтрации
        stats: JSONObject = {
            "total_messages": 0,
            "pending_retry": 0,
            "max_retries_exceeded": 0,
            "by_event_type": {},
            "workspace_id": str(workspace_id) if workspace_id else None,
        }

        # TODO: Добавить реальные запросы к БД для подсчета статистики
        # с учетом workspace_id фильтра

        return stats
