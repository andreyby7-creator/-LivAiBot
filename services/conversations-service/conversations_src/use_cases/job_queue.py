from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..adapters.db.models import JobQueue
from ..config.settings import Settings
from ..use_cases.dlq import DLQService
from .retry_utils import process_job

# JSON-compatible types for payload data
JSONValue = str | int | float | bool | None | list["JSONValue"] | dict[str, "JSONValue"]
JSONObject = dict[str, JSONValue]


class JobQueueService:
    """Сервис для обработки очереди задач с retry/dedupe логикой."""

    def __init__(
        self, db_session: AsyncSession, settings: Settings, dlq_service: DLQService
    ):
        self.db_session = db_session
        self.settings = settings
        self.dlq_service = dlq_service

    async def enqueue_job(
        self,
        workspace_id: uuid.UUID,
        operation_id: uuid.UUID | None,
        job_type: str,
        payload: JSONObject,
        priority: int = 0,
        max_attempts: int = 3,
    ) -> JobQueue:
        """Добавить задачу в очередь с проверкой на дубликаты.

        Если operation_id уже обработан - возвращает существующую задачу.
        """

        # Проверяем на дубликат по operation_id (если указан)
        if operation_id:
            existing_job = await self._get_job_by_operation_id(
                workspace_id, operation_id
            )
            if existing_job:
                return existing_job

        # Создаем новую задачу
        job = JobQueue(
            workspace_id=workspace_id,
            operation_id=operation_id,
            job_type=job_type,
            payload=payload,
            priority=priority,
            max_attempts=max_attempts,
            status="pending",
        )

        self.db_session.add(job)
        await self.db_session.commit()

        return job

    async def process_pending_jobs(self, limit: int = 10) -> int:
        """Обработать ожидающие задачи из очереди."""

        # Получаем задачи для обработки (сортировка по приоритету и времени создания)
        pending_jobs = await self._get_pending_jobs(limit)

        processed_count = 0

        for job in pending_jobs:
            try:
                # Помечаем как обрабатываемую
                await self._mark_job_started(job.id)

                # Обрабатываем задачу
                await self._process_job(job)

                # Помечаем как завершенную
                await self._mark_job_completed(job.id)

                processed_count += 1

            except Exception as e:
                # При ошибке увеличиваем счетчик попыток
                await self._mark_job_failed(job.id, str(e))

                job.attempts += 1

                if job.attempts >= job.max_attempts:
                    # Отправляем в DLQ
                    await self.dlq_service.add_to_dlq(
                        workspace_id=job.workspace_id,
                        operation_id=job.operation_id,
                        event_type=f"job_{job.job_type}_failed",
                        payload=job.payload,
                        error_message=(
                            f"Job failed after {job.attempts} attempts: {str(e)}"
                        ),
                        error_code="JOB_PROCESSING_ERROR",
                        original_table="job_queue",
                        original_id=job.id,
                        retry_count=job.attempts,
                        max_retries=job.max_attempts,
                    )

                    # Помечаем задачу как отправленную в DLQ
                    await self._mark_job_dlq_sent(job.id)
                else:
                    # Планируем следующий retry через экспоненциальную задержку
                    # В реальности это должно быть реализовано через отдельный механизм
                    # retry (например, scheduler или отдельный процесс)
                    pass

        await self.db_session.commit()
        return processed_count

    async def process_job_with_retry(self, job: JobQueue) -> None:
        """Обработать задачу с retry и dedupe."""
        await process_job(job, self.db_session)

    async def _get_job_by_operation_id(
        self, workspace_id: uuid.UUID, operation_id: uuid.UUID
    ) -> JobQueue | None:
        """Получить задачу по operation_id для проверки дубликатов."""
        stmt = select(JobQueue).where(
            JobQueue.workspace_id == workspace_id,
            JobQueue.operation_id == operation_id,
            JobQueue.status.in_(
                ["pending", "processing", "completed"]
            ),  # Не возвращаем failed/dlq
        )
        result = await self.db_session.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_pending_jobs(self, limit: int) -> list[JobQueue]:
        """Получить задачи для обработки, отсортированные по приоритету."""
        stmt = (
            select(JobQueue)
            .where(JobQueue.status == "pending")
            .order_by(JobQueue.priority.desc(), JobQueue.created_at.asc())
            .limit(limit)
        )

        result = await self.db_session.execute(stmt)
        return list(result.scalars().all())

    async def _mark_job_started(self, job_id: uuid.UUID) -> None:
        """Пометить задачу как начатую обработку."""
        stmt = (
            update(JobQueue)
            .where(JobQueue.id == job_id)
            .values(status="processing", started_at=datetime.now(timezone.utc))
        )
        await self.db_session.execute(stmt)

    async def _mark_job_completed(self, job_id: uuid.UUID) -> None:
        """Пометить задачу как завершенную."""
        stmt = (
            update(JobQueue)
            .where(JobQueue.id == job_id)
            .values(status="completed", completed_at=datetime.now(timezone.utc))
        )
        await self.db_session.execute(stmt)

    async def _mark_job_failed(self, job_id: uuid.UUID, error_message: str) -> None:
        """Пометить задачу как неудачную."""
        stmt = (
            update(JobQueue)
            .where(JobQueue.id == job_id)
            .values(
                status="failed",
                failed_at=datetime.now(timezone.utc),
                error_message=error_message,
            )
        )
        await self.db_session.execute(stmt)

    async def _mark_job_dlq_sent(self, job_id: uuid.UUID) -> None:
        """Пометить задачу как отправленную в DLQ."""
        stmt = update(JobQueue).where(JobQueue.id == job_id).values(status="dlq_sent")
        await self.db_session.execute(stmt)

    async def _process_job(self, job: JobQueue) -> None:
        """Обработать задачу (заглушка для конкретной логики)."""
        # Здесь должна быть логика обработки конкретного типа задачи
        # Пока просто симулируем успешную обработку
        if job.job_type == "example_job":
            # Пример обработки
            pass
        else:
            raise ValueError(f"Unknown job type: {job.job_type}")
