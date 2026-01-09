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
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_conversation_threads_workspace_id",
        "conversation_threads",
        ["workspace_id"],
        unique=False,
    )
    op.create_index(
        "ix_conversation_threads_bot_id",
        "conversation_threads",
        ["bot_id"],
        unique=False,
    )
    op.create_index(
        "ix_conversation_threads_operation_id",
        "conversation_threads",
        ["operation_id"],
        unique=False,
    )
    op.create_index(
        "ix_threads_workspace_id_id",
        "conversation_threads",
        ["workspace_id", "id"],
        unique=False,
    )

    op.create_table(
        "conversation_messages",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_conversation_messages_workspace_id",
        "conversation_messages",
        ["workspace_id"],
        unique=False,
    )
    op.create_index(
        "ix_conversation_messages_thread_id",
        "conversation_messages",
        ["thread_id"],
        unique=False,
    )
    op.create_index(
        "ix_conversation_messages_bot_id",
        "conversation_messages",
        ["bot_id"],
        unique=False,
    )
    op.create_index(
        "ix_conversation_messages_operation_id",
        "conversation_messages",
        ["operation_id"],
        unique=False,
    )
    op.create_index(
        "ix_messages_workspace_thread",
        "conversation_messages",
        ["workspace_id", "thread_id"],
        unique=False,
    )
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

    # Таблица для webhook событий (для будущих интеграций)
    op.create_table(
        "webhook_events",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_webhook_events_workspace_id",
        "webhook_events",
        ["workspace_id"],
        unique=False,
    )
    op.create_index(
        "ix_webhook_events_operation_id",
        "webhook_events",
        ["operation_id"],
        unique=False,
    )
    op.create_index(
        "ix_webhook_events_external_id", "webhook_events", ["external_id"], unique=False
    )
    op.create_index(
        "ix_webhook_events_status", "webhook_events", ["status"], unique=False
    )

    # Таблица для джоб (асинхронные задачи)
    op.create_table(
        "job_queue",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("job_type", sa.String(length=64), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_job_queue_workspace_id", "job_queue", ["workspace_id"], unique=False
    )
    op.create_index(
        "ix_job_queue_operation_id", "job_queue", ["operation_id"], unique=False
    )
    op.create_index("ix_job_queue_status", "job_queue", ["status"], unique=False)
    op.create_index("ix_job_queue_priority", "job_queue", ["priority"], unique=False)
    op.create_index(
        "ix_job_queue_created_at", "job_queue", ["created_at"], unique=False
    )

    # DLQ (Dead Letter Queue) таблица для неудачных сообщений
    op.create_table(
        "dead_letter_queue",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("original_table", sa.String(length=64), nullable=False),
        sa.Column("original_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_dead_letter_queue_workspace_id",
        "dead_letter_queue",
        ["workspace_id"],
        unique=False,
    )
    op.create_index(
        "ix_dead_letter_queue_operation_id",
        "dead_letter_queue",
        ["operation_id"],
        unique=False,
    )
    op.create_index(
        "ix_dead_letter_queue_event_type",
        "dead_letter_queue",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        "ix_dead_letter_queue_next_retry_at",
        "dead_letter_queue",
        ["next_retry_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_dead_letter_queue_next_retry_at", table_name="dead_letter_queue")
    op.drop_index("ix_dead_letter_queue_event_type", table_name="dead_letter_queue")
    op.drop_index("ix_dead_letter_queue_operation_id", table_name="dead_letter_queue")
    op.drop_index("ix_dead_letter_queue_workspace_id", table_name="dead_letter_queue")
    op.drop_table("dead_letter_queue")

    op.drop_index("ix_job_queue_created_at", table_name="job_queue")
    op.drop_index("ix_job_queue_priority", table_name="job_queue")
    op.drop_index("ix_job_queue_status", table_name="job_queue")
    op.drop_index("ix_job_queue_operation_id", table_name="job_queue")
    op.drop_index("ix_job_queue_workspace_id", table_name="job_queue")
    op.drop_table("job_queue")

    op.drop_index("ix_webhook_events_status", table_name="webhook_events")
    op.drop_index("ix_webhook_events_external_id", table_name="webhook_events")
    op.drop_index("ix_webhook_events_operation_id", table_name="webhook_events")
    op.drop_index("ix_webhook_events_workspace_id", table_name="webhook_events")
    op.drop_table("webhook_events")

    op.drop_index(
        "ux_messages_workspace_thread_operation_role",
        table_name="conversation_messages",
    )
    op.drop_index(
        "ix_messages_workspace_thread_operation", table_name="conversation_messages"
    )
    op.drop_index("ix_messages_workspace_thread", table_name="conversation_messages")
    op.drop_index(
        "ix_conversation_messages_operation_id", table_name="conversation_messages"
    )
    op.drop_index("ix_conversation_messages_bot_id", table_name="conversation_messages")
    op.drop_index(
        "ix_conversation_messages_thread_id", table_name="conversation_messages"
    )
    op.drop_index(
        "ix_conversation_messages_workspace_id", table_name="conversation_messages"
    )
    op.drop_table("conversation_messages")

    op.drop_index("ix_threads_workspace_id_id", table_name="conversation_threads")
    op.drop_index(
        "ix_conversation_threads_operation_id", table_name="conversation_threads"
    )
    op.drop_index("ix_conversation_threads_bot_id", table_name="conversation_threads")
    op.drop_index(
        "ix_conversation_threads_workspace_id", table_name="conversation_threads"
    )
    op.drop_table("conversation_threads")
