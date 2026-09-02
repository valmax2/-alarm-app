"""Fase 9 v2: preset di prompt riutilizzabili (categorie/tag)

Revision ID: 0010_prompt_presets
Revises: 0009_generation_live_progress
Create Date: 2026-09-02
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_prompt_presets"
down_revision: str | None = "0009_generation_live_progress"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "prompt_presets",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("text_it", sa.Text(), nullable=True),
        sa.Column("text_en", sa.Text(), nullable=False),
        sa.Column("negative_text_en", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_prompt_presets_name", "prompt_presets", ["name"])
    op.create_index("ix_prompt_presets_category", "prompt_presets", ["category"])


def downgrade() -> None:
    op.drop_index("ix_prompt_presets_category", table_name="prompt_presets")
    op.drop_index("ix_prompt_presets_name", table_name="prompt_presets")
    op.drop_table("prompt_presets")
