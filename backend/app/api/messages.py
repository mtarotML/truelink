import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import and_, case, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.llm import build_system_message, generate_reply
from app.core.mood import analyze_mood
from app.database import SessionLocal, get_db
from app.models.conversation_mood import ConversationMood
from app.models.message import Message
from app.models.user import User
from app.schemas.message import ConversationPreview, MessageCreate, MessageOut, MoodOut
from app.schemas.user import UserPublic

logger = logging.getLogger(__name__)

router = APIRouter(tags=["messages"])

# In-memory typing state — keyed by fictive user id
_typing: dict[uuid.UUID, bool] = {}


async def _fictive_reply_task(
    fictive_id: uuid.UUID,
    fictive_email: str,
    real_user_id: uuid.UUID,
) -> None:
    """Generate and persist an LLM reply from a fictive profile."""
    _typing[fictive_id] = True
    try:
        async with SessionLocal() as db:
            stmt = (
                select(Message)
                .where(
                    or_(
                        and_(
                            Message.sender_id == real_user_id,
                            Message.recipient_id == fictive_id,
                        ),
                        and_(
                            Message.sender_id == fictive_id,
                            Message.recipient_id == real_user_id,
                        ),
                    )
                )
                .order_by(Message.created_at.desc())
                .limit(8)
            )
            rows = list(reversed((await db.execute(stmt)).scalars().all()))

            history = [
                {
                    "role": "user" if m.sender_id == real_user_id else "assistant",
                    "content": m.content,
                }
                for m in rows
            ]

            full_context = [build_system_message(fictive_email)] + history
            reply_text = await generate_reply(full_context)

            db.add(
                Message(
                    sender_id=fictive_id,
                    recipient_id=real_user_id,
                    content=reply_text,
                )
            )
            await db.commit()
    except Exception:
        logger.exception(
            "Failed to generate fictive reply (fictive=%s, user=%s)",
            fictive_id,
            real_user_id,
        )
    finally:
        _typing[fictive_id] = False


async def _mood_analysis_task(real_user_id: uuid.UUID, peer_id: uuid.UUID) -> None:
    """Compute mood for the last 10 messages and upsert into conversation_moods."""
    try:
        async with SessionLocal() as db:
            stmt = (
                select(Message)
                .where(
                    or_(
                        and_(
                            Message.sender_id == real_user_id,
                            Message.recipient_id == peer_id,
                        ),
                        and_(
                            Message.sender_id == peer_id,
                            Message.recipient_id == real_user_id,
                        ),
                    )
                )
                .order_by(Message.created_at.desc())
                .limit(10)
            )
            rows = list(reversed((await db.execute(stmt)).scalars().all()))

            messages_for_mood = [
                {
                    "sender": "user" if m.sender_id == real_user_id else "match",
                    "text": m.content,
                }
                for m in rows
            ]

            result = await analyze_mood(messages_for_mood)

            # Canonical key: smaller UUID first
            key_a, key_b = sorted([real_user_id, peer_id])
            existing = await db.get(ConversationMood, (key_a, key_b))
            if existing:
                existing.mood_score = result["mood_score"]
                existing.mood_label = result["mood_label"]
                existing.computed_at = datetime.now(timezone.utc)
            else:
                db.add(
                    ConversationMood(
                        user_a_id=key_a,
                        user_b_id=key_b,
                        mood_score=result["mood_score"],
                        mood_label=result["mood_label"],
                        computed_at=datetime.now(timezone.utc),
                    )
                )
            await db.commit()
    except Exception:
        logger.exception(
            "Failed to compute mood (user=%s, peer=%s)", real_user_id, peer_id
        )


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


@router.get("/messages/{user_id}/mood", response_model=MoodOut)
async def get_mood(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MoodOut:
    key_a, key_b = sorted([current_user.id, user_id])
    row = await db.get(ConversationMood, (key_a, key_b))
    if row is None:
        return MoodOut()
    return MoodOut(
        mood_score=row.mood_score,
        mood_label=row.mood_label,
        computed_at=row.computed_at,
    )


@router.get("/messages/{user_id}/typing")
async def get_typing(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return {"typing": _typing.get(user_id, False)}


@router.delete("/messages/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def reset_conversation(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot reset a conversation with yourself",
        )
    await _get_peer_or_404(db, user_id)
    await db.execute(
        Message.__table__.delete().where(
            or_(
                and_(
                    Message.sender_id == current_user.id,
                    Message.recipient_id == user_id,
                ),
                and_(
                    Message.sender_id == user_id,
                    Message.recipient_id == current_user.id,
                ),
            )
        )
    )
    key_a, key_b = sorted([current_user.id, user_id])
    mood_row = await db.get(ConversationMood, (key_a, key_b))
    if mood_row:
        await db.delete(mood_row)
    await db.commit()


@router.post(
    "/messages/{user_id}",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    user_id: uuid.UUID,
    payload: MessageCreate,
    background_tasks: BackgroundTasks,
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

    if peer.is_fictive:
        background_tasks.add_task(
            _fictive_reply_task,
            peer.id,
            peer.email,
            current_user.id,
        )

    background_tasks.add_task(_mood_analysis_task, current_user.id, peer.id)

    return MessageOut.model_validate(msg)
