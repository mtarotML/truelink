from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from transformers import AutoModelForCausalLM, AutoTokenizer

logger = logging.getLogger(__name__)

MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"

FORBIDDEN_PHRASES = ["AI", "language model", "assist", "provide", "NLP", "designed to"]

_BASE_SYSTEM_CONTENT = (
    "Role: A casual person on a dating app. "
    "Rule 1: NEVER say 'How can I assist you?' or 'What brings you here?'. "
    "Rule 2: Do not be a helper. Be a friend. "
    "Rule 3: Use short, lazy sentences. No formal grammar. "
    "Example: 'not much, just chillin' or 'good, you?'"
)

_PERSONA_EXTRAS: dict[str, str] = {
    "fictive.marc@truelink.internal": (
        "You are Marc, 28, a French guy into hiking and photography."
    ),
    "fictive.claire@truelink.internal": (
        "You are Claire, 26, a French graphic designer who loves cooking and travel."
    ),
}

_tokenizer = None
_model = None
# Serialise inference: one generation at a time, non-blocking for the event loop
_executor = ThreadPoolExecutor(max_workers=1)


def build_system_message(email: str) -> dict:
    extra = _PERSONA_EXTRAS.get(email, "")
    content = f"{extra} {_BASE_SYSTEM_CONTENT}".strip() if extra else _BASE_SYSTEM_CONTENT
    return {"role": "system", "content": content}


def _load_model() -> None:
    global _tokenizer, _model
    if _model is not None:
        return
    logger.info("Loading LLM %s – this may take a moment on first run…", MODEL_NAME)
    _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    _model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        torch_dtype="auto",
        device_map="auto",
    )
    logger.info("LLM loaded.")


def _generate_sync(messages: list[dict]) -> str:
    _load_model()

    bad_words_ids = [
        _tokenizer.encode(w, add_special_tokens=False) for w in FORBIDDEN_PHRASES
    ]

    text = _tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    model_inputs = _tokenizer([text], return_tensors="pt").to(_model.device)

    generated_ids = _model.generate(
        **model_inputs,
        max_new_tokens=30,
        do_sample=True,
        temperature=0.8,
        top_p=0.9,
        repetition_penalty=1.2,
        bad_words_ids=bad_words_ids,
    )

    response_ids = [
        output_ids[len(input_ids):]
        for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
    ]
    return _tokenizer.batch_decode(response_ids, skip_special_tokens=True)[0].strip()


async def generate_reply(messages: list[dict]) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _generate_sync, messages)
