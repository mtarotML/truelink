"""messages table

Revision ID: 0002_messages
Revises: 0001_initial
Create Date: 2026-04-19 12:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_messages"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_messages_sender_id", "messages", ["sender_id"], unique=False
    )
    op.create_index(
        "ix_messages_recipient_id", "messages", ["recipient_id"], unique=False
    )
    op.create_index(
        "ix_messages_pair_created",
        "messages",
        ["sender_id", "recipient_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_messages_recipient_unread",
        "messages",
        ["recipient_id", "read_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_messages_recipient_unread", table_name="messages")
    op.drop_index("ix_messages_pair_created", table_name="messages")
    op.drop_index("ix_messages_recipient_id", table_name="messages")
    op.drop_index("ix_messages_sender_id", table_name="messages")
    op.drop_table("messages")
