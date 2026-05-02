import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Gender(str, enum.Enum):
    male = "male"
    female = "female"


class Intent(str, enum.Enum):
    long_term = "long_term"
    short_term = "short_term"


class Role(str, enum.Enum):
    user = "user"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    gender: Mapped[Gender | None] = mapped_column(
        Enum(Gender, name="gender_enum"), nullable=True
    )
    gender_pref: Mapped[Gender | None] = mapped_column(
        Enum(Gender, name="gender_enum"), nullable=True
    )
    intent: Mapped[Intent | None] = mapped_column(
        Enum(Intent, name="intent_enum"), nullable=True
    )

    device_id: Mapped[str | None] = mapped_column(
        String(128), unique=True, index=True, nullable=True
    )

    onboarded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_fictive: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )

    role: Mapped[Role] = mapped_column(
        Enum(Role, name="role_enum"),
        nullable=False,
        default=Role.user,
        server_default=Role.user.value,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
