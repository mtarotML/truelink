import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserPublic


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender_id: uuid.UUID
    recipient_id: uuid.UUID
    content: str
    created_at: datetime
    read_at: datetime | None


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class ConversationPreview(BaseModel):
    user: UserPublic
    last_message: MessageOut
    unread_count: int
