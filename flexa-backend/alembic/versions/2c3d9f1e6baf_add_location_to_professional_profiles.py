"""add location to professional profiles

Revision ID: 2c3d9f1e6baf
Revises: 001_add_marketplace_models
Create Date: 2026-04-20 14:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "2c3d9f1e6baf"
down_revision = "001_add_marketplace_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "professional_profiles",
        sa.Column("location", sa.String(length=150), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("professional_profiles", "location")
