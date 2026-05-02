from __future__ import annotations

import asyncio
import json
import logging

from groq import APIError, AsyncGroq

from app.config import settings

logger = logging.getLogger(__name__)

_RETRY_DELAYS = [3, 8]  # seconds between attempts (3 total attempts)

_client: AsyncGroq | None = None

_SYSTEM_PROMPT = (
    "You are a conversation mood analyzer. "
    "Given a short chat exchange, return ONLY a valid JSON object with two fields:\n"
    '  "mood_score": a float between -1.0 (very negative) and 1.0 (very positive)\n'
    '  "mood_label": one of exactly these strings: "Very Positive", "Positive", "Neutral", "Negative", "Very Negative"\n'
    "No explanation, no markdown, no extra text — only the raw JSON object.\n\n"
    "Scoring rules:\n"
    "- Short, dead-end replies that show no effort or interest (e.g. 'ok', 'okay', 'yes', 'no', 'k', 'lol', 'haha', 'sure', 'fine', 'cool') "
    "must be penalised: apply a penalty of at least -0.3 to the score. "
    "If the overall conversation already leans positive but the latest reply is one of these low-effort responses, bring the score down noticeably.\n"
    "- Replies that ask a question, share something personal, or genuinely continue the conversation should be rewarded with a higher score.\n"
    "- Balance both sides of the conversation: if [You] is engaging but [Match] keeps giving dead-end replies, score negatively."
)

_FALLBACK = {"mood_score": 0.0, "mood_label": "Neutral"}


def _get_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _client


def _format_conversation(messages: list[dict]) -> str:
    return "\n".join(
        f"{'[You]' if m['sender'] == 'user' else '[Match]'}: {m['text']}"
        for m in messages[-10:]
    )


def _parse_response(raw: str) -> dict:
    result = json.loads(raw)
    score = round(max(-1.0, min(1.0, float(result["mood_score"]))), 4)
    label = result["mood_label"]
    if label not in {"Very Positive", "Positive", "Neutral", "Negative", "Very Negative"}:
        label = "Neutral"
    return {"mood_score": score, "mood_label": label}


async def analyze_mood(messages: list[dict]) -> dict:
    if not messages:
        return _FALLBACK

    conversation = _format_conversation(messages)
    last_exc: Exception | None = None

    for attempt, delay in enumerate([0] + _RETRY_DELAYS):
        if delay:
            logger.warning("Groq mood error — retrying in %ds (attempt %d/3)", delay, attempt + 1)
            await asyncio.sleep(delay)
        try:
            response = await _get_client().chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": conversation},
                ],
                max_tokens=60,
                temperature=0.0,
            )
            return _parse_response(response.choices[0].message.content.strip())
        except APIError as e:
            last_exc = e
            logger.warning("Groq API error for mood (attempt %d/3): %s", attempt + 1, e)
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            last_exc = e
            logger.warning("Invalid mood response from Groq (attempt %d/3): %s", attempt + 1, e)
        except Exception as e:
            last_exc = e
            logger.warning("Unexpected mood error (attempt %d/3): %s", attempt + 1, e)

    logger.error("Mood analysis failed after 3 attempts: %s", last_exc)
    return _FALLBACK
