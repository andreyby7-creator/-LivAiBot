"""add audit_log table

Revision ID: 0002_add_audit_log
Revises: 0001_init_auth
Create Date: 2026-01-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_add_audit_log"
down_revision = "0001_init_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("changes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_audit_log_workspace_id", "audit_log", ["workspace_id"], unique=False
    )
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"], unique=False)
    op.create_index(
        "ix_audit_log_operation_id", "audit_log", ["operation_id"], unique=False
    )
    op.create_index(
        "ix_audit_log_resource_id", "audit_log", ["resource_id"], unique=False
    )
    op.create_index(
        "ix_audit_log_workspace_action",
        "audit_log",
        ["workspace_id", "action"],
        unique=False,
    )
    op.create_index(
        "ix_audit_log_workspace_resource",
        "audit_log",
        ["workspace_id", "resource_type", "resource_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_audit_log_workspace_resource", table_name="audit_log")
    op.drop_index("ix_audit_log_workspace_action", table_name="audit_log")
    op.drop_index("ix_audit_log_resource_id", table_name="audit_log")
    op.drop_index("ix_audit_log_operation_id", table_name="audit_log")
    op.drop_index("ix_audit_log_user_id", table_name="audit_log")
    op.drop_index("ix_audit_log_workspace_id", table_name="audit_log")
    op.drop_table("audit_log")
