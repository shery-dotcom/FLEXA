"""Restore professional_profiles table

Revision ID: e43750172339
Revises: 47af8b518046
Create Date: 2026-05-05 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'e43750172339'
down_revision = '47af8b518046'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'professional_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('specialization', sa.String(length=50), nullable=False),
        sa.Column('bio', sa.Text(), nullable=False),
        sa.Column('years_experience', sa.Integer(), nullable=False),
        sa.Column('certifications', sa.Text(), nullable=False),
        sa.Column('languages', sa.Text(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('verification_document_url', sa.Text(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('consultation_price_usd', sa.Float(), nullable=False),
        sa.Column('consultation_duration_mins', sa.Integer(), nullable=False),
        sa.Column('average_rating', sa.Float(), nullable=True),
        sa.Column('total_reviews', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_sessions_completed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default='UTC'),
        sa.Column('is_accepting_clients', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('max_clients_per_week', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('location', sa.String(length=150), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
        sa.Index('ix_professional_profiles_user_id', 'user_id', unique=True),
    )


def downgrade() -> None:
    op.drop_table('professional_profiles')
