from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"

EMOTION_WEIGHTS = {
    "joy":      +1.0,
    "surprise": +0.3,
    "neutral":   0.0,
    "fear":     -0.5,
    "sadness":  -0.8,
    "anger":    -1.0,
    "disgust":  -0.9,
}

_classifier = None
_executor = ThreadPoolExecutor(max_workers=1)


def _load_classifier() -> None:
    global _classifier
    if _classifier is not None:
        return
    from transformers import pipeline  # noqa: PLC0415
    logger.info("Loading mood classifier %s – ~80 MB on first run…", MODEL_NAME)
    _classifier = pipeline(
        "text-classification",
        model=MODEL_NAME,
        top_k=None,
        device=-1,
    )
    logger.info("Mood classifier loaded.")


def _analyze_sync(messages: list[dict]) -> dict:
    """Synchronous analysis — runs in ThreadPoolExecutor."""
    _load_classifier()

    last_10 = messages[-5:]
    lines = [
        f"{'[You]' if m['sender'] == 'user' else '[Match]'}: {m['text']}"
        for m in last_10
    ]
    conversation = "\n".join(lines)

    raw_scores = _classifier(conversation[:512])[0]
    emotion_scores = {item["label"]: round(item["score"], 4) for item in raw_scores}

    mood_score = sum(
        emotion_scores.get(emotion, 0) * weight
        for emotion, weight in EMOTION_WEIGHTS.items()
    )
    mood_score = round(max(-1.0, min(1.0, mood_score)), 4)

    if mood_score >= 0.5:
        mood_label = "Very Positive"
    elif mood_score >= 0.15:
        mood_label = "Positive"
    elif mood_score >= -0.15:
        mood_label = "Neutral"
    elif mood_score >= -0.5:
        mood_label = "Negative"
    else:
        mood_label = "Very Negative"

    return {"mood_score": mood_score, "mood_label": mood_label}


async def analyze_mood(messages: list[dict]) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _analyze_sync, messages)
