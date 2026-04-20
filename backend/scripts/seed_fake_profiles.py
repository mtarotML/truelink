"""Insert 5 onboarded fake users with generated placeholder avatars.

Run inside the backend container (DATABASE_URL and /media must be available):

    docker compose exec backend python scripts/seed_fake_profiles.py

Idempotent: removes previous rows with the same seed emails, then re-inserts.
"""

from __future__ import annotations

import asyncio
import io
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import delete

from app.config import settings
from app.database import SessionLocal
from app.models.user import Gender, Intent, User

SEED_EMAILS = [
    "seed.alice@truelink.seed",
    "seed.beatrice@truelink.seed",
    "seed.claire@truelink.seed",
    "seed.david@truelink.seed",
    "seed.eric@truelink.seed",
]

# Mix of genders / intents so discovery can return matches for different real users
PROFILES: list[dict] = [
    {
        "first_name": "Alice",
        "last_name": "Martin",
        "gender": Gender.female,
        "gender_pref": Gender.male,
        "intent": Intent.long_term,
        "color": (236, 47, 138),
        "initials": "AM",
    },
    {
        "first_name": "Béatrice",
        "last_name": "Dubois",
        "gender": Gender.female,
        "gender_pref": Gender.male,
        "intent": Intent.long_term,
        "color": (80, 120, 200),
        "initials": "BD",
    },
    {
        "first_name": "Claire",
        "last_name": "Bernard",
        "gender": Gender.female,
        "gender_pref": Gender.male,
        "intent": Intent.long_term,
        "color": (50, 180, 140),
        "initials": "CB",
    },
    {
        "first_name": "David",
        "last_name": "Leroy",
        "gender": Gender.male,
        "gender_pref": Gender.female,
        "intent": Intent.long_term,
        "color": (200, 100, 60),
        "initials": "DL",
    },
    {
        "first_name": "Eric",
        "last_name": "Petit",
        "gender": Gender.male,
        "gender_pref": Gender.female,
        "intent": Intent.short_term,
        "color": (120, 80, 180),
        "initials": "EP",
    },
]


def _write_avatar(filename: str, color: tuple[int, int, int], initials: str) -> str:
    media = Path(settings.MEDIA_ROOT)
    media.mkdir(parents=True, exist_ok=True)
    path = media / filename

    size = 512
    img = Image.new("RGB", (size, size), color)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 160)
    except OSError:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), initials, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) // 2
    y = (size - th) // 2 - 20
    draw.text((x, y), initials, fill=(255, 255, 255), font=font)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True)
    path.write_bytes(buf.getvalue())

    return f"{settings.PUBLIC_MEDIA_BASE.rstrip('/')}/{filename}"


async def main() -> None:
    async with SessionLocal() as session:
        await session.execute(delete(User).where(User.email.in_(SEED_EMAILS)))

        for email, spec in zip(SEED_EMAILS, PROFILES, strict=True):
            filename = f"seed_{uuid.uuid4().hex[:12]}.jpg"
            photo_url = _write_avatar(filename, spec["color"], spec["initials"])
            user = User(
                id=uuid.uuid4(),
                email=email,
                first_name=spec["first_name"],
                last_name=spec["last_name"],
                photo_url=photo_url,
                gender=spec["gender"],
                gender_pref=spec["gender_pref"],
                intent=spec["intent"],
                device_id=f"seed_fp_{uuid.uuid4().hex[:16]}",
                onboarded=True,
            )
            session.add(user)

        await session.commit()
        print(f"Inserted {len(SEED_EMAILS)} fake profiles under {settings.MEDIA_ROOT}")


if __name__ == "__main__":
    asyncio.run(main())
