"""add llm_turns table

Revision ID: 0002_llm_turns
Revises: 0001_init_conversations
Create Date: 2026-01-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_llm_turns"
down_revision = "0001_init_conversations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_turns",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("bot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("input", sa.Text(), nullable=False),
        sa.Column("output", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_llm_turns_workspace_id", "llm_turns", ["workspace_id"], unique=False
    )
    op.create_index(
        "ix_llm_turns_operation_id", "llm_turns", ["operation_id"], unique=False
    )
    op.create_index("ix_llm_turns_user_id", "llm_turns", ["user_id"], unique=False)
    op.create_index("ix_llm_turns_bot_id", "llm_turns", ["bot_id"], unique=False)
    op.create_index(
        "ix_llm_turns_created_at", "llm_turns", ["created_at"], unique=False
    )
    # Уникальный индекс по operation_id для предотвращения дубликатов
    op.create_index(
        "ux_llm_turns_workspace_operation_id",
        "llm_turns",
        ["workspace_id", "operation_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_llm_turns_workspace_operation_id", table_name="llm_turns")
    op.drop_index("ix_llm_turns_created_at", table_name="llm_turns")
    op.drop_index("ix_llm_turns_bot_id", table_name="llm_turns")
    op.drop_index("ix_llm_turns_user_id", table_name="llm_turns")
    op.drop_index("ix_llm_turns_operation_id", table_name="llm_turns")
    op.drop_index("ix_llm_turns_workspace_id", table_name="llm_turns")
    op.drop_table("llm_turns")
