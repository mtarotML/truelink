import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.security import create_access_token
from app.core.storage import save_profile_photo
from app.database import get_db
from app.models.user import Gender, Intent, Role, User
from app.schemas.user import AuthResponse, UserAdmin, UserMe

_MAX_PHOTO_BYTES = 8 * 1024 * 1024

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserAdmin])
async def list_users(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> list[UserAdmin]:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [UserAdmin.model_validate(u) for u in users]


@router.post("/impersonate/{user_id}", response_model=AuthResponse)
async def impersonate(
    user_id: uuid.UUID,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot impersonate yourself",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="user not found"
        )
    if target.role == Role.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot impersonate another admin",
        )

    token = create_access_token(target.id)
    return AuthResponse(token=token, user=UserMe.model_validate(target))


@router.post("/users", response_model=UserAdmin, status_code=status.HTTP_201_CREATED)
async def create_user(
    first_name: str = Form(..., min_length=1, max_length=80),
    last_name: str = Form(default="", max_length=80),
    gender: Gender = Form(...),
    gender_pref: Gender = Form(...),
    intent: Intent = Form(...),
    bio: str | None = Form(default=None, max_length=500),
    is_fictive: bool = Form(default=True),
    photo: UploadFile | None = File(default=None),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> UserAdmin:
    photo_url: str | None = None
    if photo is not None:
        raw = await photo.read()
        if len(raw) > 0:
            if len(raw) > _MAX_PHOTO_BYTES:
                raise HTTPException(status_code=413, detail="photo too large (max 8 MB)")
            try:
                photo_url = save_profile_photo(raw, photo.content_type or "")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

    fake_email = f"profile.{uuid.uuid4().hex[:12]}@truelink.internal"
    user = User(
        email=fake_email,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        gender=gender,
        gender_pref=gender_pref,
        intent=intent,
        bio=bio.strip() if bio else None,
        photo_url=photo_url,
        is_fictive=is_fictive,
        onboarded=True,
        device_id=f"manual_{uuid.uuid4().hex[:12]}",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserAdmin.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    admin_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot delete yourself",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="user not found"
        )
    await db.delete(target)
    await db.commit()
