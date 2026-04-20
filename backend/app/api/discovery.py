from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserPublic

router = APIRouter(tags=["discovery"])

DISCOVERY_COUNT = 3


@router.get("/discovery", response_model=list[UserPublic])
async def discovery(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserPublic]:
    if not current_user.onboarded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="complete onboarding before viewing discovery",
        )

    stmt = (
        select(User)
        .where(
            User.id != current_user.id,
            User.onboarded.is_(True),
            User.gender == current_user.gender_pref,
            User.intent == current_user.intent,
        )
        .order_by(func.random())
        .limit(DISCOVERY_COUNT)
    )
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [UserPublic.model_validate(u) for u in users]
