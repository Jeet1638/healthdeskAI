"""add appointment email tracking

Revision ID: 0003_appointment_email_tracking
Revises: 0002_email_notification_settings
Create Date: 2026-06-13 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_appointment_email_tracking"
down_revision = "0002_email_notification_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column("confirmation_email_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("reminder_email_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "reminder_email_sent_at")
    op.drop_column("appointments", "confirmation_email_sent_at")
