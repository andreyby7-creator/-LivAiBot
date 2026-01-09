"""init conversations tables

Revision ID: 0001_init_conversations
Revises:
Create Date: 2026-01-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0001_init_conversations"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "conversation_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_conversation_threads_workspace_id", "conversation_threads", ["workspace_id"], unique=False)
    op.create_index("ix_conversation_threads_bot_id", "conversation_threads", ["bot_id"], unique=False)
    op.create_index("ix_threads_workspace_id_id", "conversation_threads", ["workspace_id", "id"], unique=False)

    op.create_table(
        "conversation_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_conversation_messages_workspace_id", "conversation_messages", ["workspace_id"], unique=False)
    op.create_index("ix_conversation_messages_thread_id", "conversation_messages", ["thread_id"], unique=False)
    op.create_index("ix_conversation_messages_bot_id", "conversation_messages", ["bot_id"], unique=False)
    op.create_index("ix_conversation_messages_operation_id", "conversation_messages", ["operation_id"], unique=False)
    op.create_index("ix_messages_workspace_thread", "conversation_messages", ["workspace_id", "thread_id"], unique=False)
    op.create_index(
        "ix_messages_workspace_thread_operation",
        "conversation_messages",
        ["workspace_id", "thread_id", "operation_id"],
        unique=False,
    )
    op.create_index(
        "ux_messages_workspace_thread_operation_role",
        "conversation_messages",
        ["workspace_id", "thread_id", "operation_id", "role"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_messages_workspace_thread_operation_role", table_name="conversation_messages")
    op.drop_index("ix_messages_workspace_thread_operation", table_name="conversation_messages")
    op.drop_index("ix_messages_workspace_thread", table_name="conversation_messages")
    op.drop_index("ix_conversation_messages_operation_id", table_name="conversation_messages")
    op.drop_index("ix_conversation_messages_bot_id", table_name="conversation_messages")
    op.drop_index("ix_conversation_messages_thread_id", table_name="conversation_messages")
    op.drop_index("ix_conversation_messages_workspace_id", table_name="conversation_messages")
    op.drop_table("conversation_messages")

    op.drop_index("ix_threads_workspace_id_id", table_name="conversation_threads")
    op.drop_index("ix_conversation_threads_bot_id", table_name="conversation_threads")
    op.drop_index("ix_conversation_threads_workspace_id", table_name="conversation_threads")
    op.drop_table("conversation_threads")

