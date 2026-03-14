from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import DeadLetterQueue


class DLQRepository:
    """Repository for Dead Letter Queue operations."""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def add_to_dlq(
        self,
        workspace_id: uuid.UUID,
        operation_id: uuid.UUID | None,
        event_type: str,
        payload: dict,
        error_message: str,
        error_code: str | None = None,
        original_table: str | None = None,
        original_id: uuid.UUID | None = None,
        retry_count: int = 0,
        max_retries: int = 3,
    ) -> uuid.UUID:
        """Add message to DLQ."""
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
        """Get messages from DLQ ready for retry."""
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

    async def get_by_id(self, dlq_id: uuid.UUID) -> DeadLetterQueue | None:
        """Get DLQ entry by ID."""
        stmt = select(DeadLetterQueue).where(DeadLetterQueue.id == dlq_id)
        result = await self.db_session.execute(stmt)
        return result.scalar_one_or_none()

    async def mark_retry_attempt(
        self,
        dlq_id: uuid.UUID,
        success: bool,
        error_message: str | None = None,
        next_retry_delay_minutes: int = 5,
    ) -> None:
        """Mark retry attempt for DLQ entry."""
        dlq_entry = await self.get_by_id(dlq_id)
        if not dlq_entry:
            return

        dlq_entry.retry_count += 1
        dlq_entry.last_attempt_at = datetime.now(timezone.utc)

        if success:
            # Successfully processed - remove from DLQ
            await self.db_session.delete(dlq_entry)
        else:
            # Failed - schedule next retry
            if dlq_entry.retry_count < dlq_entry.max_retries:
                dlq_entry.next_retry_at = datetime.now(timezone.utc) + timedelta(
                    minutes=next_retry_delay_minutes
                )
                dlq_entry.error_message = error_message or dlq_entry.error_message
            # If exceeded max_retries, leave in DLQ for manual processing

        await self.db_session.commit()

    async def get_dlq_stats(self, workspace_id: uuid.UUID | None = None) -> dict:
        """Get DLQ statistics."""
        now = datetime.now(timezone.utc)

        # Общее количество сообщений
        total_stmt = select(func.count(DeadLetterQueue.id))
        if workspace_id is not None:
            total_stmt = total_stmt.where(DeadLetterQueue.workspace_id == workspace_id)
        total_result = await self.db_session.execute(total_stmt)
        total_messages = total_result.scalar_one() or 0

        # Сообщения, готовые к retry
        # (retry_count < max_retries и next_retry_at <= now или None)
        pending_stmt = select(func.count(DeadLetterQueue.id)).where(
            (DeadLetterQueue.retry_count < DeadLetterQueue.max_retries)
            & (
                (DeadLetterQueue.next_retry_at.is_(None))
                | (DeadLetterQueue.next_retry_at <= now)
            )
        )
        if workspace_id is not None:
            pending_stmt = pending_stmt.where(
                DeadLetterQueue.workspace_id == workspace_id
            )
        pending_result = await self.db_session.execute(pending_stmt)
        pending_retry = pending_result.scalar_one() or 0

        # Сообщения, где превышен max_retries
        exceeded_stmt = select(func.count(DeadLetterQueue.id)).where(
            DeadLetterQueue.retry_count >= DeadLetterQueue.max_retries
        )
        if workspace_id is not None:
            exceeded_stmt = exceeded_stmt.where(
                DeadLetterQueue.workspace_id == workspace_id
            )
        exceeded_result = await self.db_session.execute(exceeded_stmt)
        max_retries_exceeded = exceeded_result.scalar_one() or 0

        # Группировка по event_type
        by_event_type_stmt = (
            select(
                DeadLetterQueue.event_type,
                func.count(DeadLetterQueue.id).label("count"),
            )
            .group_by(DeadLetterQueue.event_type)
        )
        if workspace_id is not None:
            by_event_type_stmt = by_event_type_stmt.where(
                DeadLetterQueue.workspace_id == workspace_id
            )
        by_event_type_result = await self.db_session.execute(by_event_type_stmt)
        by_event_type = {
            row.event_type: row.count for row in by_event_type_result.all()
        }

        stats = {
            "total_messages": total_messages,
            "pending_retry": pending_retry,
            "max_retries_exceeded": max_retries_exceeded,
            "by_event_type": by_event_type,
            "workspace_id": str(workspace_id) if workspace_id else None,
        }

        return stats
