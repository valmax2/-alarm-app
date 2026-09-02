"""Modello workflow (Fase 3): workflows, workflow_versions

Revision ID: 0004_workflows
Revises: 0003_ai_providers
Create Date: 2026-09-02
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_workflows"
down_revision: str | None = "0003_ai_providers"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workflows",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("intent", sa.String(length=64), nullable=True),
        sa.Column("family", sa.String(length=64), nullable=True),
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="user_created"),
        sa.Column("current_version_id", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "workflow_versions",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("workflow_id", sa.String(length=32), sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("graph_json", sa.Text(), nullable=False),
        sa.Column("comfy_api_payload_json", sa.Text(), nullable=True),
        sa.Column("validation_result_json", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_workflow_versions_workflow_id", "workflow_versions", ["workflow_id"])


def downgrade() -> None:
    op.drop_index("ix_workflow_versions_workflow_id", table_name="workflow_versions")
    op.drop_table("workflow_versions")
    op.drop_table("workflows")
