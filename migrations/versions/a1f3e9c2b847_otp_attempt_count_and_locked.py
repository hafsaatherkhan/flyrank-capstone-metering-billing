"""otp_attempt_count_and_locked

Adds attempt_count and locked columns to password_reset_tokens to support
OTP brute-force freeze logic (max 5 wrong attempts) and resend cooldown.

Revision ID: a1f3e9c2b847
Revises: d0cabecb28e4
Create Date: 2026-10-26 00:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f3e9c2b847'
down_revision: Union[str, None] = 'd0cabecb28e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "password_reset_tokens",
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "password_reset_tokens",
        sa.Column("locked", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("password_reset_tokens", "locked")
    op.drop_column("password_reset_tokens", "attempt_count")
