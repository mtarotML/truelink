import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, case, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.message import Message
from app.models.user import User
from app.schemas.message import ConversationPreview, MessageCreate, MessageOut
from app.schemas.user import UserPublic

router = APIRouter(tags=["messages"])


async def _get_peer_or_404(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    peer = result.scalar_one_or_none()
    if peer is None or not peer.onboarded:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user not found",
        )
    return peer


@router.get("/users/{user_id}", response_model=UserPublic)
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserPublic:
    peer = await _get_peer_or_404(db, user_id)
    return UserPublic.model_validate(peer)


@router.get("/conversations", response_model=list[ConversationPreview])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationPreview]:
    me_id = current_user.id

    peer_id = case(
        (Message.sender_id == me_id, Message.recipient_id),
        else_=Message.sender_id,
    ).label("peer_id")

    last_msg_subq = (
        select(
            peer_id,
            func.max(Message.created_at).label("last_at"),
        )
        .where(or_(Message.sender_id == me_id, Message.recipient_id == me_id))
        .group_by(peer_id)
        .subquery()
    )

    stmt = (
        select(Message, User)
        .join(
            last_msg_subq,
            and_(
                or_(
                    and_(
                        Message.sender_id == me_id,
                        Message.recipient_id == last_msg_subq.c.peer_id,
                    ),
                    and_(
                        Message.recipient_id == me_id,
                        Message.sender_id == last_msg_subq.c.peer_id,
                    ),
                ),
                Message.created_at == last_msg_subq.c.last_at,
            ),
        )
        .join(User, User.id == last_msg_subq.c.peer_id)
        .order_by(desc(Message.created_at))
    )

    rows = (await db.execute(stmt)).all()

    unread_stmt = (
        select(Message.sender_id, func.count(Message.id))
        .where(Message.recipient_id == me_id, Message.read_at.is_(None))
        .group_by(Message.sender_id)
    )
    unread_map = {
        sender_id: count for sender_id, count in (await db.execute(unread_stmt)).all()
    }

    return [
        ConversationPreview(
            user=UserPublic.model_validate(peer),
            last_message=MessageOut.model_validate(msg),
            unread_count=unread_map.get(peer.id, 0),
        )
        for msg, peer in rows
    ]


@router.get("/messages/{user_id}", response_model=list[MessageOut])
async def get_messages(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageOut]:
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot open a conversation with yourself",
        )
    peer = await _get_peer_or_404(db, user_id)

    stmt = (
        select(Message)
        .where(
            or_(
                and_(
                    Message.sender_id == current_user.id,
                    Message.recipient_id == peer.id,
                ),
                and_(
                    Message.sender_id == peer.id,
                    Message.recipient_id == current_user.id,
                ),
            )
        )
        .order_by(Message.created_at.asc())
    )
    messages = (await db.execute(stmt)).scalars().all()

    await db.execute(
        update(Message)
        .where(
            Message.sender_id == peer.id,
            Message.recipient_id == current_user.id,
            Message.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()

    return [MessageOut.model_validate(m) for m in messages]


@router.post(
    "/messages/{user_id}",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    user_id: uuid.UUID,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageOut:
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot message yourself",
        )
    if not current_user.onboarded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="complete onboarding before sending messages",
        )
    peer = await _get_peer_or_404(db, user_id)

    content = payload.content.strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="message cannot be empty",
        )

    msg = Message(
        sender_id=current_user.id,
        recipient_id=peer.id,
        content=content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return MessageOut.model_validate(msg)
