from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import settings
from app.core.google import GoogleAuthError, verify_google_id_token
from app.core.security import create_access_token
from app.database import get_db
from app.models.user import Role, User
from app.schemas.user import AuthResponse, GoogleAuthRequest, UserMe

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

    admin_email = (settings.ADMIN_EMAIL or "").lower().strip()
    should_be_admin = bool(admin_email) and email == admin_email

    if user is None:
        if payload.device_id:
            dupe = await db.execute(
                select(User).where(User.device_id == payload.device_id)
            )
            if dupe.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="this device is already associated with another account",
                )

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
