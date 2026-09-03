"""Oscuramento per singola immagine personaggio (is_hidden)

Revision ID: 0011_character_image_hidden
Revises: 0010_prompt_presets
Create Date: 2026-09-03
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_character_image_hidden"
down_revision: str | None = "0010_prompt_presets"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "character_images",
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("character_images", "is_hidden")
