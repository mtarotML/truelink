from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.exclusive_mode import ExclusiveMode, ExclusiveStatus
from app.models.user import User
from app.schemas.user import UserPublic

router = APIRouter(tags=["discovery"])


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

    me = current_user.id

    # In active exclusive mode → return only the exclusive partner
    exclusive_stmt = select(ExclusiveMode).where(
        ExclusiveMode.status == ExclusiveStatus.active,
        or_(
            ExclusiveMode.requester_id == me,
            ExclusiveMode.partner_id == me,
        ),
    )
    exclusive = (await db.execute(exclusive_stmt)).scalar_one_or_none()
    if exclusive:
        partner_id = (
            exclusive.partner_id if exclusive.requester_id == me else exclusive.requester_id
        )
        result = await db.execute(select(User).where(User.id == partner_id))
        partner = result.scalar_one_or_none()
        if partner:
            return [UserPublic.model_validate(partner)]
        return []

    stmt = (
        select(User)
        .where(
            User.is_fictive.is_(True),
            User.gender == current_user.gender_pref,
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    user = result.scalars().first()
    if user is None:
        return []
    return [UserPublic.model_validate(user)]
