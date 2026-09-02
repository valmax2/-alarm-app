"""Inventory Engine (Fase 2): nodes, node_schemas, models, model_metadata

Revision ID: 0002_inventory
Revises: 0001_initial
Create Date: 2026-09-02
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_inventory"
down_revision: str | None = "0001_initial"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "nodes",
        sa.Column("id", sa.String(length=600), primary_key=True),
        sa.Column(
            "comfy_instance_id",
            sa.String(length=32),
            sa.ForeignKey("comfy_instances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("class_type", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=255), nullable=False),
        sa.Column("is_custom_node", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source_extension", sa.String(length=255), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_nodes_comfy_instance_id", "nodes", ["comfy_instance_id"])

    op.create_table(
        "node_schemas",
        sa.Column(
            "node_id",
            sa.String(length=600),
            sa.ForeignKey("nodes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("raw_schema", sa.Text(), nullable=False),
        sa.Column("input_summary", sa.Text(), nullable=False),
        sa.Column("output_summary", sa.Text(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "models",
        sa.Column("id", sa.String(length=600), primary_key=True),
        sa.Column(
            "comfy_instance_id",
            sa.String(length=32),
            sa.ForeignKey("comfy_instances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=500), nullable=False),
        sa.Column("path", sa.String(length=1000), nullable=False),
        sa.Column("model_type", sa.String(length=64), nullable=False),
        sa.Column("extension", sa.String(length=32), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("family", sa.String(length=64), nullable=True),
        sa.Column("architecture", sa.String(length=128), nullable=True),
        sa.Column("detection_confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("detection_source", sa.String(length=64), nullable=False, server_default="internal_rule"),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_models_comfy_instance_id", "models", ["comfy_instance_id"])
    op.create_index("ix_models_model_type", "models", ["model_type"])
    op.create_index("ix_models_family", "models", ["family"])

    op.create_table(
        "model_metadata",
        sa.Column(
            "model_id",
            sa.String(length=600),
            sa.ForeignKey("models.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("raw_header", sa.Text(), nullable=True),
        sa.Column("extra", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("model_metadata")
    op.drop_index("ix_models_family", table_name="models")
    op.drop_index("ix_models_model_type", table_name="models")
    op.drop_index("ix_models_comfy_instance_id", table_name="models")
    op.drop_table("models")
    op.drop_table("node_schemas")
    op.drop_index("ix_nodes_comfy_instance_id", table_name="nodes")
    op.drop_table("nodes")
