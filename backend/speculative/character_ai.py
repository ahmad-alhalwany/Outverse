"""AI-assisted character generation for the Imaginary Characters Market.

Two use cases, one shared helper:
- create-from-prompt: a user describes an idea, AI turns it into a character.
- merge-fusion: two owned characters combine into one new, higher-rarity one.

Tone matches the app's existing creative-content conventions (warm,
imaginative, no dark/violent themes) — mirrors challenges/ai.py's use of
the shared questions.llm helper, with a curated fallback pool when no LLM
provider key is configured.
"""

from __future__ import annotations

import json
import random
import zlib

from questions.llm import llm_text

RARITY_ORDER = ['rare', 'epic', 'legendary']
DEFAULT_PRICE_BY_RARITY = {'rare': 100, 'epic': 275, 'legendary': 550}

EMOJI_POOL = [
    '🧙', '🧙‍♀️', '🧚', '🧚‍♂️', '🧝', '🧝‍♀️', '🐉', '🦄', '🦉', '🔮',
    '🌙', '⭐', '💫', '🌟', '👻', '🤖', '🐺', '🦋', '🕯️', '⚗️',
    '📜', '🗝️', '🧿', '⚔️', '🛡️', '🏹', '🍄', '🦂', '🐍', '🦅',
    '🎭', '🌊', '❄️', '🔥', '🌸', '🍃', '🕸️', '💎', '🪐', '☄️',
]


def emoji_for(character_id: int, fallback: str = '') -> str:
    if fallback:
        return fallback
    idx = zlib.crc32(str(character_id).encode()) % len(EMOJI_POOL)
    return EMOJI_POOL[idx]


def next_rarity(rarity: str) -> str | None:
    try:
        idx = RARITY_ORDER.index(rarity)
    except ValueError:
        return None
    if idx + 1 >= len(RARITY_ORDER):
        return None
    return RARITY_ORDER[idx + 1]


CREATE_SYSTEM = (
    "You invent a whimsical fictional character for Cosmory, a warm social "
    "creativity app's collectible character market. Keep it playful, imaginative, "
    "gentle — no violence, horror, or dark themes. "
    "Return ONLY valid JSON with keys: name, description, emoji. "
    "name max 6 words. description max 30 words, third-person, evocative. "
    "emoji: exactly one or two emoji characters that best represent the character. "
    "No markdown."
)

MERGE_SYSTEM = (
    "You fuse two fictional characters into one new character for Cosmory's "
    "collectible character market, genuinely blending traits and themes from "
    "both source characters. Keep it playful, imaginative, gentle — no violence, "
    "horror, or dark themes. "
    "Return ONLY valid JSON with keys: name, description, emoji. "
    "name max 6 words. description max 30 words, third-person, evocative. "
    "emoji: exactly one or two emoji characters. No markdown."
)

FALLBACK_POOL = {
    'rare': [
        {'name': 'Glimmer, the Half-Remembered', 'description': 'A faint spark of an idea you almost had; still trying to finish its own sentence.', 'emoji': '✨'},
        {'name': 'Thistle the Wandering Footnote', 'description': 'Escaped from a story’s margins; collects tiny facts nobody asked for.', 'emoji': '🍃'},
        {'name': 'Bramblekin the Shy Echo', 'description': 'Repeats the last kind thing anyone said nearby, a little quieter each time.', 'emoji': '🦔'},
    ],
    'epic': [
        {'name': 'The Understudy of Fate', 'description': 'Has rehearsed every possible ending; still hopes for a new one to be written.', 'emoji': '🎭'},
        {'name': 'Cinder, Keeper of Almosts', 'description': 'Guards every idea that almost happened, polishing them for someone braver.', 'emoji': '🔥'},
    ],
    'legendary': [
        {'name': 'The Loom Between Drafts', 'description': 'Weaves unfinished stories together while the world isn’t looking.', 'emoji': '🪐'},
        {'name': 'Sovereign of Second Chances', 'description': 'Rules a tiny kingdom where every failed idea gets one more try.', 'emoji': '👑'},
    ],
}


def _parse_payload(raw: str | None) -> dict | None:
    text = (raw or '').strip()
    if not text:
        return None
    if text.startswith('```'):
        text = text.strip('`')
        if text.startswith('json'):
            text = text[4:].strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find('{')
        end = text.rfind('}')
        if start < 0 or end <= start:
            return None
        try:
            data = json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return None
    if not isinstance(data, dict):
        return None
    name = str(data.get('name') or '').strip()[:100]
    description = str(data.get('description') or '').strip()[:400]
    emoji = str(data.get('emoji') or '').strip()[:8]
    if not name:
        return None
    return {'name': name, 'description': description or 'A curious character, still writing their own story.', 'emoji': emoji}


def generate_character(
    *,
    prompt: str | None = None,
    source_names: tuple[str, str] | None = None,
    rarity: str = 'rare',
    language: str = 'en',
) -> dict:
    """Returns {'name', 'description', 'emoji', 'is_ai_generated'} — AI first, then curated fallback."""
    lang_line = 'Write the name and description in Arabic.' if language == 'ar' else 'Write the name and description in English.'
    if source_names:
        a, b = source_names
        raw = llm_text(
            MERGE_SYSTEM,
            f'{lang_line} Fuse "{a}" and "{b}" into one new character. Return JSON only.',
            max_tokens=180,
            temperature=0.9,
        )
    else:
        base = (prompt or 'a mysterious creative character').strip()[:300]
        raw = llm_text(
            CREATE_SYSTEM,
            f'{lang_line} Invent a character based on this idea: "{base}". Return JSON only.',
            max_tokens=160,
            temperature=0.9,
        )

    parsed = _parse_payload(raw)
    if parsed:
        parsed['is_ai_generated'] = True
        return parsed
    pick = dict(random.choice(FALLBACK_POOL.get(rarity, FALLBACK_POOL['rare'])))
    pick['is_ai_generated'] = False
    return pick
