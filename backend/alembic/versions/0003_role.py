"""user role

Revision ID: 0003_role
Revises: 0002_messages
Create Date: 2026-04-19 13:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_role"
down_revision: Union[str, None] = "0002_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLE_VALUES = ("user", "admin")


def upgrade() -> None:
    bind = op.get_bind()
    postgresql.ENUM(*ROLE_VALUES, name="role_enum").create(bind, checkfirst=True)
    role_enum = postgresql.ENUM(
        *ROLE_VALUES, name="role_enum", create_type=False
    )
    op.add_column(
        "users",
        sa.Column(
            "role",
            role_enum,
            nullable=False,
            server_default="user",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "role")
    bind = op.get_bind()
    postgresql.ENUM(name="role_enum").drop(bind, checkfirst=True)
