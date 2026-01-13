from __future__ import annotations

from sqlalchemy import Column, DateTime, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB

from .base import Base


class LLMTurn(Base):
    """LLM turn - взаимодействие с языковой моделью."""

    __tablename__ = "llm_turns"

    id = Column(Integer, primary_key=True)
    operation_id = Column(String, nullable=False, unique=True, index=True)
    input_data = Column(JSONB, nullable=False)
    output_data = Column(JSONB)
    status = Column(String, default="pending")  # pending | success | failed
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    __table_args__ = (Index("idx_llmturn_operation_id", "operation_id"),)
