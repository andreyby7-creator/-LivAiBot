from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..adapters.db.models import WebhookEvent
from ..config.settings import Settings
from ..use_cases.dlq import DLQService

# JSON-compatible types for payload data
JSONValue = str | int | float | bool | None | list["JSONValue"] | dict[str, "JSONValue"]
JSONObject = dict[str, JSONValue]


class WebhookEventsService:
    """Сервис для обработки webhook событий с retry/dedupe логикой."""

    def __init__(
        self, db_session: AsyncSession, settings: Settings, dlq_service: DLQService
    ):
        self.db_session = db_session
        self.settings = settings
        self.dlq_service = dlq_service

    async def process_webhook_event(
        self,
        workspace_id: uuid.UUID,
        operation_id: uuid.UUID | None,
        event_type: str,
        external_id: str | None,
        payload: JSONObject,
    ) -> WebhookEvent:
        """Обработать webhook событие с проверкой на дубликаты.

        Если operation_id уже обработан - возвращает существующий event.
        Если обработка успешна - создает новый event.
        При ошибках - отправляет в DLQ для retry.
        """

        # Проверяем на дубликат по operation_id (если указан)
        if operation_id:
            existing_event = await self._get_event_by_operation_id(
                workspace_id, operation_id
            )
            if existing_event:
                return existing_event

        # Создаем новый event
        event = WebhookEvent(
            workspace_id=workspace_id,
            operation_id=operation_id,
            event_type=event_type,
            external_id=external_id,
            payload=payload,
            status="processing",
            attempts=0,
        )

        self.db_session.add(event)
        await self.db_session.flush()  # Получаем ID

        try:
            # Здесь должна быть логика обработки события
            # Пока просто помечаем как успешное
            await self._mark_event_processed(event.id)
            return event

        except Exception as e:
            # При ошибке отправляем в DLQ для retry
            await self.dlq_service.add_to_dlq(
                workspace_id=workspace_id,
                operation_id=operation_id,
                event_type=f"webhook_{event_type}",
                payload=payload,
                error_message=str(e),
                error_code="WEBHOOK_PROCESSING_ERROR",
                original_table="webhook_events",
                original_id=event.id,
            )

            # Помечаем event как failed
            await self._mark_event_failed(event.id, str(e))
            raise

    async def retry_failed_events(self, limit: int = 10) -> int:
        """Повторная обработка неудачных webhook событий."""

        # Получаем события, готовые для retry
        failed_events = await self._get_failed_events_for_retry(limit)

        processed_count = 0

        for event in failed_events:
            try:
                # Повторная обработка
                await self._process_event_retry(event)
                processed_count += 1

            except Exception as e:
                # Если снова ошибка - увеличиваем счетчик попыток
                event.attempts += 1

                if event.attempts >= 3:  # max_attempts
                    # Отправляем в DLQ
                    await self.dlq_service.add_to_dlq(
                        workspace_id=event.workspace_id,
                        operation_id=event.operation_id,
                        event_type=f"webhook_{event.event_type}_failed",
                        payload=event.payload,
                        error_message=(
                            f"Failed after {event.attempts} attempts: {str(e)}"
                        ),
                        error_code="WEBHOOK_RETRY_EXHAUSTED",
                        original_table="webhook_events",
                        original_id=event.id,
                        retry_count=event.attempts,
                        max_retries=3,
                    )
                    event.status = "dlq_sent"
                else:
                    # Планируем следующий retry через экспоненциальную задержку
                    # В реальности нужно сохранить время следующего retry в базе
                    # next_retry_delay = min(300, 60 * (2 ** (event.attempts - 1)))
                    pass

        await self.db_session.commit()
        return processed_count

    async def _get_event_by_operation_id(
        self, workspace_id: uuid.UUID, operation_id: uuid.UUID
    ) -> WebhookEvent | None:
        """Получить событие по operation_id для проверки дубликатов."""
        stmt = select(WebhookEvent).where(
            WebhookEvent.workspace_id == workspace_id,
            WebhookEvent.operation_id == operation_id,
        )
        result = await self.db_session.execute(stmt)
        return result.scalar_one_or_none()

    async def _mark_event_processed(self, event_id: uuid.UUID) -> None:
        """Пометить событие как успешно обработанное."""
        stmt = select(WebhookEvent).where(WebhookEvent.id == event_id)
        result = await self.db_session.execute(stmt)
        event = result.scalar_one_or_none()

        if event:
            event.status = "processed"
            event.processed_at = datetime.now(timezone.utc)

    async def _mark_event_failed(self, event_id: uuid.UUID, error_message: str) -> None:
        """Пометить событие как неудачное."""
        stmt = select(WebhookEvent).where(WebhookEvent.id == event_id)
        result = await self.db_session.execute(stmt)
        event = result.scalar_one_or_none()

        if event:
            event.status = "failed"
            event.attempts += 1

    async def _get_failed_events_for_retry(self, limit: int) -> list[WebhookEvent]:
        """Получить неудачные события, готовые для повторной обработки."""
        # В реальной реализации нужно учитывать время следующего retry
        stmt = (
            select(WebhookEvent)
            .where(
                WebhookEvent.status == "failed",
                WebhookEvent.attempts < 3,  # max_attempts
            )
            .limit(limit)
        )

        result = await self.db_session.execute(stmt)
        return list(result.scalars().all())

    async def _process_event_retry(self, event: WebhookEvent) -> None:
        """Повторная обработка события."""
        # Здесь должна быть логика повторной обработки
        # Пока просто помечаем как успешное
        event.status = "processed"
        event.processed_at = datetime.now(timezone.utc)
