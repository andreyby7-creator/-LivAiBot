"""alter llm_turns table to use integer primary key and string operation_id

Revision ID: 0003_alter_llm_turns
Revises: 0002_llm_turns
Create Date: 2026-01-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_alter_llm_turns"
down_revision = "0002_llm_turns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Сначала удаляем все индексы
    op.drop_index("ux_llm_turns_workspace_operation_id", table_name="llm_turns")
    op.drop_index("ix_llm_turns_created_at", table_name="llm_turns")
    op.drop_index("ix_llm_turns_bot_id", table_name="llm_turns")
    op.drop_index("ix_llm_turns_user_id", table_name="llm_turns")
    op.drop_index("ix_llm_turns_operation_id", table_name="llm_turns")
    op.drop_index("ix_llm_turns_workspace_id", table_name="llm_turns")

    # Удаляем старую таблицу
    op.drop_table("llm_turns")

    # Создаем новую таблицу с новой структурой
    op.create_table(
        "llm_turns",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("operation_id", sa.String(), nullable=False),
        sa.Column(
            "input_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("output_data", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Создаем индексы
    op.create_index(
        "idx_llmturn_operation_id", "llm_turns", ["operation_id"], unique=False
    )
    op.create_unique_constraint(
        "uq_llm_turns_operation_id", "llm_turns", ["operation_id"]
    )


def downgrade() -> None:
    # Удаляем новую таблицу
    op.drop_index("idx_llmturn_operation_id", table_name="llm_turns")
    op.drop_constraint("uq_llm_turns_operation_id", "llm_turns", type_="unique")
    op.drop_table("llm_turns")

    # Восстанавливаем старую таблицу
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
    op.create_index(
        "ux_llm_turns_workspace_operation_id",
        "llm_turns",
        ["workspace_id", "operation_id"],
        unique=True,
    )
