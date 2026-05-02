from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.exclusive_mode import ExclusiveMode, ExclusiveStatus
from app.models.mood_streak import MoodStreak
from app.models.user import User
from app.schemas.exclusive import ExclusiveRespondRequest, ExclusiveStatusOut

router = APIRouter(tags=["exclusive"])

_ELIGIBLE_STREAK = 2


async def _pair_exclusive(
    db: AsyncSession, me: uuid.UUID, peer: uuid.UUID
) -> ExclusiveMode | None:
    """Return pending or active ExclusiveMode row for this pair, if any."""
    stmt = select(ExclusiveMode).where(
        ExclusiveMode.status.in_([ExclusiveStatus.pending, ExclusiveStatus.active]),
        or_(
            and_(ExclusiveMode.requester_id == me, ExclusiveMode.partner_id == peer),
            and_(ExclusiveMode.requester_id == peer, ExclusiveMode.partner_id == me),
        ),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _active_exclusive(
    db: AsyncSession, user_id: uuid.UUID
) -> ExclusiveMode | None:
    """Return the active ExclusiveMode for a user, if any."""
    stmt = select(ExclusiveMode).where(
        ExclusiveMode.status == ExclusiveStatus.active,
        or_(
            ExclusiveMode.requester_id == user_id,
            ExclusiveMode.partner_id == user_id,
        ),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


def _build_status_out(
    row: ExclusiveMode, me: uuid.UUID, peer: User
) -> ExclusiveStatusOut:
    if row.status == ExclusiveStatus.active:
        return ExclusiveStatusOut(
            status="active",
            partner_id=peer.id,
            partner_name=peer.first_name,
        )
    if row.requester_id == me:
        return ExclusiveStatusOut(
            status="pending_sent",
            partner_id=peer.id,
            partner_name=peer.first_name,
        )
    return ExclusiveStatusOut(
        status="pending_received",
        partner_id=peer.id,
        partner_name=peer.first_name,
    )


@router.get("/exclusive", response_model=ExclusiveStatusOut)
async def get_my_exclusive(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExclusiveStatusOut:
    """Return the current user's active exclusive mode (for discovery page)."""
    row = await _active_exclusive(db, current_user.id)
    if not row:
        return ExclusiveStatusOut(status="none")
    partner_id = (
        row.partner_id if row.requester_id == current_user.id else row.requester_id
    )
    result = await db.execute(select(User).where(User.id == partner_id))
    partner = result.scalar_one_or_none()
    return ExclusiveStatusOut(
        status="active",
        partner_id=partner_id,
        partner_name=partner.first_name if partner else None,
    )


@router.get("/exclusive/{peer_id}", response_model=ExclusiveStatusOut)
async def get_exclusive_status(
    peer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExclusiveStatusOut:
    me = current_user.id

    result = await db.execute(select(User).where(User.id == peer_id))
    peer = result.scalar_one_or_none()
    if not peer or not peer.onboarded:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    row = await _pair_exclusive(db, me, peer_id)
    if row:
        return _build_status_out(row, me, peer)

    key_a, key_b = sorted([me, peer_id])
    streak_row = await db.get(MoodStreak, (key_a, key_b))
    if streak_row and streak_row.streak >= _ELIGIBLE_STREAK:
        return ExclusiveStatusOut(
            status="eligible", partner_id=peer_id, partner_name=peer.first_name
        )

    return ExclusiveStatusOut(status="none")


@router.post("/exclusive/{peer_id}/request", response_model=ExclusiveStatusOut)
async def request_exclusive(
    peer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExclusiveStatusOut:
    me = current_user.id

    key_a, key_b = sorted([me, peer_id])
    streak_row = await db.get(MoodStreak, (key_a, key_b))
    if not streak_row or streak_row.streak < _ELIGIBLE_STREAK:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="not eligible for exclusive mode yet",
        )

    if await _pair_exclusive(db, me, peer_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="exclusive request already exists",
        )

    result = await db.execute(select(User).where(User.id == peer_id))
    peer = result.scalar_one_or_none()
    if not peer or not peer.onboarded:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    record = ExclusiveMode(
        requester_id=me,
        partner_id=peer_id,
        status=ExclusiveStatus.active if peer.is_fictive else ExclusiveStatus.pending,
    )
    db.add(record)
    await db.commit()

    return _build_status_out(record, me, peer)


@router.post("/exclusive/{peer_id}/respond", response_model=ExclusiveStatusOut)
async def respond_exclusive(
    peer_id: uuid.UUID,
    payload: ExclusiveRespondRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExclusiveStatusOut:
    me = current_user.id

    stmt = select(ExclusiveMode).where(
        ExclusiveMode.status == ExclusiveStatus.pending,
        ExclusiveMode.requester_id == peer_id,
        ExclusiveMode.partner_id == me,
    )
    record = (await db.execute(stmt)).scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="no pending exclusive request from this user",
        )

    result = await db.execute(select(User).where(User.id == peer_id))
    peer = result.scalar_one_or_none()

    record.status = ExclusiveStatus.active if payload.accept else ExclusiveStatus.declined
    await db.commit()

    if payload.accept and peer:
        return _build_status_out(record, me, peer)
    return ExclusiveStatusOut(status="none")


@router.delete("/exclusive/{peer_id}")
async def end_exclusive(
    peer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    me = current_user.id

    stmt = select(ExclusiveMode).where(
        ExclusiveMode.status == ExclusiveStatus.active,
        or_(
            and_(ExclusiveMode.requester_id == me, ExclusiveMode.partner_id == peer_id),
            and_(ExclusiveMode.requester_id == peer_id, ExclusiveMode.partner_id == me),
        ),
    )
    record = (await db.execute(stmt)).scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="no active exclusive mode with this user",
        )
    record.status = ExclusiveStatus.ended
    await db.commit()
    return Response(status_code=204)
