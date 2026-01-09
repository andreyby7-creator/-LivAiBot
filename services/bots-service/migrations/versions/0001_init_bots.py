"""init bots tables

Revision ID: 0001_init_bots
Revises:
Create Date: 2026-01-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0001_init_bots"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_bots_workspace_id", "bots", ["workspace_id"], unique=False)
    op.create_index("ix_bots_workspace_id_id", "bots", ["workspace_id", "id"], unique=False)

    op.create_table(
        "bot_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=False),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_bot_versions_workspace_id", "bot_versions", ["workspace_id"], unique=False)
    op.create_index("ix_bot_versions_bot_id", "bot_versions", ["bot_id"], unique=False)
    op.create_index("ix_bot_versions_workspace_bot", "bot_versions", ["workspace_id", "bot_id"], unique=False)
    op.create_index(
        "ux_bot_versions_workspace_bot_version",
        "bot_versions",
        ["workspace_id", "bot_id", "version"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_bot_versions_workspace_bot_version", table_name="bot_versions")
    op.drop_index("ix_bot_versions_workspace_bot", table_name="bot_versions")
    op.drop_index("ix_bot_versions_bot_id", table_name="bot_versions")
    op.drop_index("ix_bot_versions_workspace_id", table_name="bot_versions")
    op.drop_table("bot_versions")

    op.drop_index("ix_bots_workspace_id_id", table_name="bots")
    op.drop_index("ix_bots_workspace_id", table_name="bots")
    op.drop_table("bots")

