"""Libreria Personaggi (Fase 7): characters, character_images

Revision ID: 0007_characters
Revises: 0006_chat_messages
Create Date: 2026-09-02
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_characters"
down_revision: str | None = "0006_chat_messages"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "characters",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        # Non una vera FK — vedi la nota in bridge/models.py (riferimento circolare
        # con character_images evitato deliberatamente).
        sa.Column("main_image_id", sa.String(length=32), nullable=True),
        sa.Column("tags", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_private", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "character_images",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("character_id", sa.String(length=32), sa.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storage_path", sa.String(length=1000), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False, server_default="reference"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(length=16), nullable=False, server_default="upload"),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_character_images_character_id", "character_images", ["character_id"])


def downgrade() -> None:
    op.drop_index("ix_character_images_character_id", table_name="character_images")
    op.drop_table("character_images")
    op.drop_table("characters")
