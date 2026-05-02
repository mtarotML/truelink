from __future__ import annotations

import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.api import admin, auth, discovery, exclusive, messages, onboarding
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models.exclusive_mode import ExclusiveMode  # noqa: F401 — register table
from app.models.mood_streak import MoodStreak  # noqa: F401 — register table
from app.models.user import Gender, Intent, User

_FICTIVE_PROFILES = [
    {
        "email": "fictive.marc@truelink.internal",
        "first_name": "Marc",
        "last_name": "",
        "gender": Gender.male,
        "gender_pref": Gender.female,
        "intent": Intent.long_term,
        "photo_src": "/fake_profile/Marc.png",
        "dest_filename": "fictive_marc.png",
    },
    {
        "email": "fictive.claire@truelink.internal",
        "first_name": "Claire",
        "last_name": "",
        "gender": Gender.female,
        "gender_pref": Gender.male,
        "intent": Intent.long_term,
        "photo_src": "/fake_profile/Claire.png",
        "dest_filename": "fictive_claire.png",
    },
]


async def _seed_fictive_profiles() -> None:
    media = Path(settings.MEDIA_ROOT)
    media.mkdir(parents=True, exist_ok=True)

    async with SessionLocal() as session:
        for spec in _FICTIVE_PROFILES:
            result = await session.execute(
                select(User).where(User.email == spec["email"])
            )
            if result.scalars().first() is not None:
                continue

            src = Path(spec["photo_src"])
            dst = media / spec["dest_filename"]
            if src.exists():
                shutil.copy(src, dst)
                photo_url = f"{settings.PUBLIC_MEDIA_BASE.rstrip('/')}/{spec['dest_filename']}"
            else:
                photo_url = None

            session.add(
                User(
                    id=uuid.uuid4(),
                    email=spec["email"],
                    first_name=spec["first_name"],
                    last_name=spec["last_name"],
                    photo_url=photo_url,
                    gender=spec["gender"],
                    gender_pref=spec["gender_pref"],
                    intent=spec["intent"],
                    device_id=f"fictive_{spec['first_name'].lower()}_{uuid.uuid4().hex[:8]}",
                    onboarded=True,
                    is_fictive=True,
                )
            )

        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_fictive_profiles()
    yield


app = FastAPI(title="TrueLink API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(onboarding.router)
app.include_router(discovery.router)
app.include_router(messages.router)
app.include_router(exclusive.router)
app.include_router(admin.router)

media_dir = Path(settings.MEDIA_ROOT)
media_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")
