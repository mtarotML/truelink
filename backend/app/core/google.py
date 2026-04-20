from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.config import settings


class GoogleAuthError(Exception):
    pass


def verify_google_id_token(token: str) -> dict:
    """Verify a Google-issued ID token and return its claims.

    Raises GoogleAuthError on any validation failure.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleAuthError("GOOGLE_CLIENT_ID is not configured")

    try:
        claims = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise GoogleAuthError(str(exc)) from exc

    if claims.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise GoogleAuthError("unexpected issuer")
    if not claims.get("email_verified"):
        raise GoogleAuthError("email not verified by Google")

    return claims
