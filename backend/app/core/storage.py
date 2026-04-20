import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps

from app.config import settings

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_DIM = 1080


def save_profile_photo(raw: bytes, content_type: str) -> str:
    """Persist an uploaded profile photo to disk and return its public URL path.

    The image is re-encoded as JPEG with EXIF rotation applied and resized so the
    longest edge is at most ``MAX_DIM`` pixels.
    """
    if content_type not in ALLOWED_MIME:
        raise ValueError(f"unsupported image type: {content_type}")

    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception as exc:
        raise ValueError("invalid image data") from exc

    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    img.thumbnail((MAX_DIM, MAX_DIM))

    filename = f"{uuid.uuid4().hex}.jpg"
    media_root = Path(settings.MEDIA_ROOT)
    media_root.mkdir(parents=True, exist_ok=True)
    img.save(media_root / filename, format="JPEG", quality=88, optimize=True)

    return f"{settings.PUBLIC_MEDIA_BASE.rstrip('/')}/{filename}"
