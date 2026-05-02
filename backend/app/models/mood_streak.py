from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MoodStreak(Base):
    __tablename__ = "mood_streaks"

    user_a_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
