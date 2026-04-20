"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-19 00:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


GENDER_VALUES = ("male", "female")
INTENT_VALUES = ("long_term", "short_term")


def upgrade() -> None:
    bind = op.get_bind()

    # Create the enum types once, idempotently.
    postgresql.ENUM(*GENDER_VALUES, name="gender_enum").create(bind, checkfirst=True)
    postgresql.ENUM(*INTENT_VALUES, name="intent_enum").create(bind, checkfirst=True)

    # Reference the already-created types in the column definitions
    # (create_type=False avoids a duplicate CREATE TYPE statement).
    gender_enum = postgresql.ENUM(
        *GENDER_VALUES, name="gender_enum", create_type=False
    )
    intent_enum = postgresql.ENUM(
        *INTENT_VALUES, name="intent_enum", create_type=False
    )

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("first_name", sa.String(length=80), nullable=True),
        sa.Column("last_name", sa.String(length=80), nullable=True),
        sa.Column("photo_url", sa.String(length=500), nullable=True),
        sa.Column("gender", gender_enum, nullable=True),
        sa.Column("gender_pref", gender_enum, nullable=True),
        sa.Column("intent", intent_enum, nullable=True),
        sa.Column("device_id", sa.String(length=128), nullable=True),
        sa.Column(
            "onboarded",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_device_id", "users", ["device_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_device_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    bind = op.get_bind()
    postgresql.ENUM(name="intent_enum").drop(bind, checkfirst=True)
    postgresql.ENUM(name="gender_enum").drop(bind, checkfirst=True)
