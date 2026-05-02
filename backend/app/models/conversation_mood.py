from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ConversationMood(Base):
    """Cached mood score for a conversation between two users.

    user_a_id is always the smaller UUID to guarantee a single canonical row
    per conversation pair regardless of message direction.
    """

    __tablename__ = "conversation_moods"

    user_a_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    mood_score: Mapped[float] = mapped_column(Float, nullable=False)
    mood_label: Mapped[str] = mapped_column(String(30), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
