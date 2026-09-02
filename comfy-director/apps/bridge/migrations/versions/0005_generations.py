"""Generazioni reali (Fase 6): generations

Revision ID: 0005_generations
Revises: 0004_workflows
Create Date: 2026-09-02
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_generations"
down_revision: str | None = "0004_workflows"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "generations",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("workflow_id", sa.String(length=32), sa.ForeignKey("workflows.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "workflow_version_id", sa.String(length=32),
            sa.ForeignKey("workflow_versions.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("comfy_instance_id", sa.String(length=32), sa.ForeignKey("comfy_instances.id"), nullable=False),
        sa.Column("comfy_prompt_id", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="queued"),
        sa.Column("seed", sa.Integer(), nullable=True),
        sa.Column("output_paths_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("node_errors_json", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_generations_workflow_id", "generations", ["workflow_id"])
    op.create_index("ix_generations_comfy_prompt_id", "generations", ["comfy_prompt_id"])


def downgrade() -> None:
    op.drop_index("ix_generations_comfy_prompt_id", table_name="generations")
    op.drop_index("ix_generations_workflow_id", table_name="generations")
    op.drop_table("generations")
