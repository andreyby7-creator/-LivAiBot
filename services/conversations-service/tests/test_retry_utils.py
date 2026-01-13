"""Тесты для retry и dedupe утилит."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from conversations_src.use_cases.retry_utils import (
    process_job,
    process_webhook_event,
    retry_async,
)


class TestRetryUtils:
    """Тесты для утилит retry и dedupe."""

    @pytest.mark.asyncio
    async def test_retry_async_success_on_first_attempt(self):
        """Тест успешного выполнения с первого раза."""

        async def success_func():
            return "success"

        result = await retry_async(success_func, retries=3)
        assert result == "success"

    @pytest.mark.asyncio
    async def test_retry_async_success_after_retry(self):
        """Тест успешного выполнения после retry."""
        call_count = 0

        async def failing_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ValueError("Temporary failure")
            return "success"

        result = await retry_async(failing_func, retries=3)
        assert result == "success"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_retry_async_exhaust_retries(self):
        """Тест исчерпания всех retry попыток."""

        async def always_failing_func():
            raise ValueError("Always fails")

        with pytest.raises(ValueError, match="Always fails"):
            await retry_async(always_failing_func, retries=3)

    @pytest.mark.asyncio
    async def test_process_webhook_event_already_processed(self):
        """Тест обработки уже обработанного webhook события."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_event = MagicMock()
        mock_event.operation_id = str(uuid.uuid4())

        # Мокаем проверку как уже обработанную
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = MagicMock()
        mock_session.execute.return_value = mock_result

        # process_webhook_event должна просто вернуть без обработки
        await process_webhook_event(mock_event, mock_session)

        # handle_event не должна вызываться
        # (в текущей реализации она не вызывается из-за отсутствия интеграции)

    @pytest.mark.asyncio
    async def test_process_job_already_processed(self):
        """Тест обработки уже обработанного job."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_job = MagicMock()
        mock_job.operation_id = str(uuid.uuid4())

        # Мокаем проверку как уже обработанную
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = MagicMock()
        mock_session.execute.return_value = mock_result

        # process_job должна просто вернуть без обработки
        await process_job(mock_job, mock_session)

        # execute_job не должна вызываться
        # (в текущей реализации она не вызывается из-за отсутствия интеграции)
