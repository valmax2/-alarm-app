"""Prompt Engine (Fase 9): prompts

Revision ID: 0008_prompts
Revises: 0007_characters
Create Date: 2026-09-02
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_prompts"
down_revision: str | None = "0007_characters"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "prompts",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("generation_id", sa.String(length=32), sa.ForeignKey("generations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("text_it", sa.Text(), nullable=True),
        sa.Column("text_en", sa.Text(), nullable=False),
        sa.Column("negative_text_en", sa.Text(), nullable=True),
        sa.Column("translation_locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("structured_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_prompts_created_at", "prompts", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_prompts_created_at", table_name="prompts")
    op.drop_table("prompts")
