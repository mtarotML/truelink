from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import String, cast, func, or_, select
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

    results: list[UserPublic] = []

    # Slot 1 — fictive match of the desired gender
    fictive_stmt = (
        select(User)
        .where(
            User.is_fictive.is_(True),
            User.gender == current_user.gender_pref,
        )
        .limit(1)
    )
    fictive = (await db.execute(fictive_stmt)).scalars().first()
    if fictive:
        results.append(UserPublic.model_validate(fictive))

    # Slot 2 — stable random real user of the desired gender.
    # MD5(candidate_id || my_id) gives a deterministic per-user ordering so the
    # same match is returned regardless of new signups.
    real_stmt = (
        select(User)
        .where(
            User.is_fictive.is_(False),
            User.onboarded.is_(True),
            User.id != me,
            User.gender == current_user.gender_pref,
        )
        .order_by(func.md5(cast(User.id, String) + str(me)))
        .limit(1)
    )
    real_user = (await db.execute(real_stmt)).scalars().first()
    if real_user:
        results.append(UserPublic.model_validate(real_user))

    return results
