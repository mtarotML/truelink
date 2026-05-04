from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.exclusive_mode import ExclusiveMode, ExclusiveStatus
from app.models.message import Message
from app.models.user import User
from app.schemas.user import UserPublic

router = APIRouter(tags=["discovery"])

MAX_CONVERSATIONS = 5


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

    # Slot 1 — fictive match (unchanged)
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

    # Slot 2 — random real user who matches and has room for more conversations

    # How many conversations does the current user already have?
    my_conv_count: int = (
        await db.execute(
            select(
                func.count(
                    func.distinct(
                        case((Message.sender_id == me, Message.recipient_id), else_=Message.sender_id)
                    )
                )
            ).where(or_(Message.sender_id == me, Message.recipient_id == me))
        )
    ).scalar_one()

    if my_conv_count < MAX_CONVERSATIONS:
        # Subquery: partner ids the current user is already talking to
        already_talking_sq = (
            select(
                case(
                    (Message.sender_id == me, Message.recipient_id),
                    else_=Message.sender_id,
                ).label("partner_id")
            )
            .where(or_(Message.sender_id == me, Message.recipient_id == me))
            .subquery()
        )

        # Correlated subquery: conversation count of a candidate user
        candidate_conv_count_sq = (
            select(
                func.count(
                    func.distinct(
                        case(
                            (Message.sender_id == User.id, Message.recipient_id),
                            else_=Message.sender_id,
                        )
                    )
                )
            )
            .where(or_(Message.sender_id == User.id, Message.recipient_id == User.id))
            .correlate(User)
            .scalar_subquery()
        )

        real_stmt = (
            select(User)
            .where(
                User.is_fictive.is_(False),
                User.onboarded.is_(True),
                User.id != me,
                User.gender == current_user.gender_pref,
                User.gender_pref == current_user.gender,
                User.id.not_in(select(already_talking_sq.c.partner_id)),
                candidate_conv_count_sq < MAX_CONVERSATIONS,
            )
            .order_by(func.random())
            .limit(1)
        )
        real_user = (await db.execute(real_stmt)).scalars().first()
        if real_user:
            results.append(UserPublic.model_validate(real_user))

    return results
