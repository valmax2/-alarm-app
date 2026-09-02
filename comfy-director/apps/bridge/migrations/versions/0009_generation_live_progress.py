"""Fase 6 v2: progresso live delle generazioni (relay WS)

Revision ID: 0009_generation_live_progress
Revises: 0008_prompts
Create Date: 2026-09-02
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_generation_live_progress"
down_revision: str | None = "0008_prompts"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("generations", sa.Column("current_node_id", sa.String(length=64), nullable=True))
    op.add_column("generations", sa.Column("progress_value", sa.Integer(), nullable=True))
    op.add_column("generations", sa.Column("progress_max", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("generations", "progress_max")
    op.drop_column("generations", "progress_value")
    op.drop_column("generations", "current_node_id")
