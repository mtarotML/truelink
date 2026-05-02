from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.storage import save_profile_photo
from app.database import get_db
from app.models.user import Gender, Intent, User
from app.schemas.user import UserMe

router = APIRouter(tags=["onboarding"])

MAX_PHOTO_BYTES = 8 * 1024 * 1024


@router.post("/onboarding", response_model=UserMe)
async def complete_onboarding(
    first_name: str = Form(..., min_length=1, max_length=80),
    last_name: str = Form(..., min_length=1, max_length=80),
    gender: Gender = Form(...),
    gender_pref: Gender = Form(...),
    intent: Intent = Form(...),
    device_id: str | None = Form(default=None),
    photo: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserMe:
    if current_user.onboarded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="profile already completed",
        )

    if device_id and not current_user.device_id:
        taken = await db.execute(select(User).where(User.device_id == device_id))
        if taken.scalar_one_or_none() is None:
            current_user.device_id = device_id

    raw = await photo.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="empty photo")
    if len(raw) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="photo too large (max 8 MB)")

    try:
        photo_url = save_profile_photo(raw, photo.content_type or "")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    current_user.first_name = first_name.strip()
    current_user.last_name = last_name.strip()
    current_user.gender = gender
    current_user.gender_pref = gender_pref
    current_user.intent = intent
    current_user.photo_url = photo_url
    current_user.onboarded = True

    await db.commit()
    await db.refresh(current_user)
    return UserMe.model_validate(current_user)
