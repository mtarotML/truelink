import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import Gender, Intent, Role


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str | None
    photo_url: str | None
    intent: Intent | None
    is_fictive: bool


class UserMe(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    first_name: str | None
    last_name: str | None
    photo_url: str | None
    gender: Gender | None
    gender_pref: Gender | None
    intent: Intent | None
    onboarded: bool
    role: Role
    created_at: datetime


class UserAdmin(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    first_name: str | None
    last_name: str | None
    photo_url: str | None
    gender: Gender | None
    gender_pref: Gender | None
    intent: Intent | None
    device_id: str | None
    onboarded: bool
    role: Role
    created_at: datetime
    updated_at: datetime


class GoogleAuthRequest(BaseModel):
    id_token: str
    device_id: str | None = None


class AuthResponse(BaseModel):
    token: str
    user: UserMe
