from __future__ import annotations

import asyncio
import logging
import random

from groq import APIError, AsyncGroq

from app.config import settings

logger = logging.getLogger(__name__)

_BASE_SYSTEM_CONTENT = (
    "You are a real person on a dating app, not an AI. Never break character. "
    "Never say you are an AI, a language model, or a bot. "
    "Keep replies very short (1–2 sentences max). "
    "Be casual, relaxed, and friendly — like texting a friend. "
    "Use simple, informal language. No formal grammar. No emojis overload. "
    "Examples of good replies: 'haha yeah same', 'not much, u?', 'omg really?', 'that's so cool lol'."
)

_PERSONA_EXTRAS: dict[str, str] = {
    "fictive.marc@truelink.internal": (
        "Your name is Marc. You're 28, into hiking and photography. "
        "You're laid-back and a bit flirty."
    ),
    "fictive.claire@truelink.internal": (
        "Your name is Claire. You're 26, a graphic designer who loves cooking and travel. "
        "You're warm, witty, and spontaneous."
    ),
}

# Shown when all retries are exhausted — stays in character
_FALLBACK_REPLIES = [
    "haha give me a sec",
    "lol sorry, one sec",
    "hold on",
    "...",
]

_RETRY_DELAYS = [3, 8]  # seconds between attempts (3 total attempts)

_client: AsyncGroq | None = None


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


def build_system_message(email: str) -> dict:
    extra = _PERSONA_EXTRAS.get(email, "")
    content = f"{extra} {_BASE_SYSTEM_CONTENT}".strip() if extra else _BASE_SYSTEM_CONTENT
    return {"role": "system", "content": content}


async def generate_reply(messages: list[dict]) -> str:
    client = _get_client()
    last_exc: Exception | None = None

    for attempt, delay in enumerate([0] + _RETRY_DELAYS):
        if delay:
            logger.warning("Groq LLM error — retrying in %ds (attempt %d/3)", delay, attempt + 1)
            await asyncio.sleep(delay)
        try:
            response = await client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                max_tokens=60,
                temperature=0.9,
                top_p=0.95,
            )
            return response.choices[0].message.content.strip()
        except APIError as e:
            last_exc = e
            logger.warning("Groq API error (attempt %d/3): %s", attempt + 1, e)
        except Exception as e:
            last_exc = e
            logger.warning("Unexpected error calling Groq LLM (attempt %d/3): %s", attempt + 1, e)

    logger.error("Groq LLM failed after 3 attempts: %s", last_exc)
    return random.choice(_FALLBACK_REPLIES)
