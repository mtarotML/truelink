from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import settings
from app.core.google import GoogleAuthError, verify_google_id_token
from app.core.security import create_access_token
from app.core.storage import save_profile_photo
from app.database import get_db
from app.models.user import Gender, Intent, Role, User
from app.schemas.user import AuthResponse, GoogleAuthRequest, UserMe

_MAX_PHOTO_BYTES = 8 * 1024 * 1024

router = APIRouter(tags=["auth"])


@router.post("/auth/google", response_model=AuthResponse)
async def auth_google(
    payload: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    try:
        claims = verify_google_id_token(payload.id_token)
    except GoogleAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"google auth failed: {exc}",
        ) from exc

    email = claims["email"].lower()

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    should_be_admin = email in settings.admin_email_set

    if user is None:
        user = User(
            email=email,
            device_id=payload.device_id,
            role=Role.admin if should_be_admin else Role.user,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        changed = False
        if payload.device_id and not user.device_id:
            user.device_id = payload.device_id
            changed = True
        if should_be_admin and user.role != Role.admin:
            user.role = Role.admin
            changed = True
        if changed:
            await db.commit()
            await db.refresh(user)

    token = create_access_token(user.id)
    return AuthResponse(token=token, user=UserMe.model_validate(user))


@router.get("/me", response_model=UserMe)
async def me(current_user: User = Depends(get_current_user)) -> UserMe:
    return UserMe.model_validate(current_user)


@router.patch("/me/profile", response_model=UserMe)
async def update_profile(
    gender: Gender | None = Form(default=None),
    gender_pref: Gender | None = Form(default=None),
    intent: Intent | None = Form(default=None),
    photo: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserMe:
    if gender is not None:
        current_user.gender = gender
    if gender_pref is not None:
        current_user.gender_pref = gender_pref
    if intent is not None:
        current_user.intent = intent
    if photo is not None:
        raw = await photo.read()
        if len(raw) == 0:
            raise HTTPException(status_code=400, detail="empty photo")
        if len(raw) > _MAX_PHOTO_BYTES:
            raise HTTPException(status_code=413, detail="photo too large (max 8 MB)")
        try:
            photo_url = save_profile_photo(raw, photo.content_type or "")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        current_user.photo_url = photo_url

    await db.commit()
    await db.refresh(current_user)
    return UserMe.model_validate(current_user)
