from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from conversations_src.adapters.db.llm_turns_model import LLMTurn


async def create_llm_turn(
    session: AsyncSession, operation_id: str, input_data: dict
) -> LLMTurn:
    """Создать LLM turn с проверкой на дубликаты по operation_id."""
    # Проверяем, не существует ли уже запись с таким operation_id
    existing = await session.execute(
        select(LLMTurn).where(LLMTurn.operation_id == operation_id)
    )
    existing_turn = existing.scalar_one_or_none()
    if existing_turn:
        return existing_turn

    llm_turn = LLMTurn(operation_id=operation_id, input_data=input_data)
    session.add(llm_turn)
    await session.commit()
    return llm_turn
