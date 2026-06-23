"""add email notification settings

Revision ID: 0002_email_notification_settings
Revises: 0001_create_initial_tables
Create Date: 2026-06-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_email_notification_settings"
down_revision = "0001_create_initial_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clinics",
        sa.Column(
            "email_notifications_escalation",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "clinics",
        sa.Column(
            "email_notifications_appointments",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("clinics", "email_notifications_appointments")
    op.drop_column("clinics", "email_notifications_escalation")
