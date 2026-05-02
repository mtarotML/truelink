import uuid

from pydantic import BaseModel


class ExclusiveStatusOut(BaseModel):
    # "none" | "eligible" | "pending_sent" | "pending_received" | "active"
    status: str
    partner_id: uuid.UUID | None = None
    partner_name: str | None = None


class ExclusiveRespondRequest(BaseModel):
    accept: bool
