"""add operation_id idempotency for bots

Revision ID: 0002_opid
Revises: 0001_init_bots
Create Date: 2026-01-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# Важно: revision id должен помещаться в varchar(32) (дефолтная длина alembic_version.version_num).
revision = "0002_opid"
down_revision = "0001_init_bots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bots", sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(
        "ux_bots_workspace_operation_id",
        "bots",
        ["workspace_id", "operation_id"],
        unique=True,
    )

    op.add_column(
        "bot_versions",
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ux_bot_versions_workspace_bot_operation_id",
        "bot_versions",
        ["workspace_id", "bot_id", "operation_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_bot_versions_workspace_bot_operation_id", table_name="bot_versions")
    op.drop_column("bot_versions", "operation_id")

    op.drop_index("ux_bots_workspace_operation_id", table_name="bots")
    op.drop_column("bots", "operation_id")

