"""Add professional marketplace models

Revision ID: 001_add_marketplace_models
Revises: bd22ed08b2da
Create Date: 2024-04-19 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '001_add_marketplace_models'
down_revision = 'bd22ed08b2da'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create professional_profiles table
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
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default='Asia/Karachi'),
        sa.Column('is_accepting_clients', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('max_clients_per_week', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_professional_profiles_user_id'), 'professional_profiles', ['user_id'], unique=True)

    # Create consultation_sessions table
    op.create_table(
        'consultation_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('professional_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('specialization_type', sa.String(length=50), nullable=False),
        sa.Column('session_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_mins', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('session_price_usd', sa.Float(), nullable=False),
        sa.Column('professional_earnings_usd', sa.Float(), nullable=False),
        sa.Column('flexa_commission_usd', sa.Float(), nullable=False),
        sa.Column('commission_rate', sa.Float(), nullable=False, server_default='0.25'),
        sa.Column('meeting_link', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('payment_id', sa.String(length=255), nullable=True),
        sa.Column('payment_status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['professional_id'], ['professional_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_consultation_sessions_user_id'), 'consultation_sessions', ['user_id'], unique=False)
    op.create_index(op.f('ix_consultation_sessions_professional_id'), 'consultation_sessions', ['professional_id'], unique=False)

    # Create availability_slots table
    op.create_table(
        'availability_slots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('professional_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_available', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('booked_session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['professional_id'], ['professional_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['booked_session_id'], ['consultation_sessions.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_availability_slots_professional_id'), 'availability_slots', ['professional_id'], unique=False)

    # Create professional_reviews table
    op.create_table(
        'professional_reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('professional_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('helpful_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['consultation_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['professional_id'], ['professional_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id')
    )
    op.create_index(op.f('ix_professional_reviews_professional_id'), 'professional_reviews', ['professional_id'], unique=False)

    # Create payments table
    op.create_table(
        'payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('professional_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('gross_amount_usd', sa.Float(), nullable=False),
        sa.Column('flexa_commission_usd', sa.Float(), nullable=False),
        sa.Column('professional_payout_usd', sa.Float(), nullable=False),
        sa.Column('payment_status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('payout_status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('refund_amount_usd', sa.Float(), nullable=True),
        sa.Column('refund_reason', sa.Text(), nullable=True),
        sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['consultation_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['professional_id'], ['professional_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payments_session_id'), 'payments', ['session_id'], unique=False)
    op.create_index(op.f('ix_payments_user_id'), 'payments', ['user_id'], unique=False)
    op.create_index(op.f('ix_payments_professional_id'), 'payments', ['professional_id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index(op.f('ix_payments_professional_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_user_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_session_id'), table_name='payments')
    op.drop_table('payments')
    
    op.drop_index(op.f('ix_professional_reviews_professional_id'), table_name='professional_reviews')
    op.drop_table('professional_reviews')
    
    op.drop_index(op.f('ix_availability_slots_professional_id'), table_name='availability_slots')
    op.drop_table('availability_slots')
    
    op.drop_index(op.f('ix_consultation_sessions_professional_id'), table_name='consultation_sessions')
    op.drop_index(op.f('ix_consultation_sessions_user_id'), table_name='consultation_sessions')
    op.drop_table('consultation_sessions')
    
    op.drop_index(op.f('ix_professional_profiles_user_id'), table_name='professional_profiles')
    op.drop_table('professional_profiles')
