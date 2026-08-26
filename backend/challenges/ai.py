"""Positive daily challenge generation for the Weirdness Lab.

Tone: warm, hopeful, creative — never dark, violent, or despairing.
Uses the shared LLM helpers from ``questions.llm`` when a provider key
is configured; otherwise falls back to a curated positive pool.
"""

from __future__ import annotations

import json
import random
from datetime import timedelta

from django.utils import timezone

from questions.llm import llm_text

from .models import Challenge

DAILY_SYSTEM = (
    "You write daily creative challenges for Cosonova, a warm social creativity app. "
    "Create ONE challenge that feels beautiful, hopeful, playful, and imaginative. "
    "STRICT TONE RULES: no darkness, death, violence, horror, loneliness-as-pain, "
    "depression, trauma, cynicism, or dystopia. Prefer light, wonder, friendship, "
    "nature, color, music, dreams, kindness, and curiosity. "
    "Return ONLY valid JSON with keys: title, description, type, difficulty. "
    "type must be one of: writing, art, music, experimental, practical. "
    "difficulty must be one of: easy, medium, hard. "
    "title max 12 words. description max 28 words. No markdown."
)

POSITIVE_FALLBACKS = [
    {
        'title': 'Paint Today as a Sunrise Color',
        'description': 'Name the color of this morning and invent a tiny story it wants to tell.',
        'type': 'art',
        'difficulty': 'easy',
    },
    {
        'title': 'Compose a Smile in Three Notes',
        'description': 'Hum or write three notes that feel like greeting a friend.',
        'type': 'music',
        'difficulty': 'easy',
    },
    {
        'title': 'Invent a Kind Superpower',
        'description': 'Design a gentle power that only helps people feel lighter.',
        'type': 'writing',
        'difficulty': 'easy',
    },
    {
        'title': 'Map a Secret Garden of Joy',
        'description': 'Sketch or describe a garden where every plant grows a happy memory.',
        'type': 'art',
        'difficulty': 'medium',
    },
    {
        'title': 'Write a Postcard from Tomorrow',
        'description': 'Send yourself good news from a bright version of next week.',
        'type': 'writing',
        'difficulty': 'easy',
    },
    {
        'title': 'Build a Pocket Festival',
        'description': 'Invent a tiny celebration for ordinary kindness that lasts ten minutes.',
        'type': 'experimental',
        'difficulty': 'medium',
    },
    {
        'title': 'Name a Cloud After Someone Kind',
        'description': 'Give today’s softest cloud a name and a cheerful job in the sky.',
        'type': 'writing',
        'difficulty': 'easy',
    },
    {
        'title': 'Design a Soundtrack for Warm Bread',
        'description': 'Describe or whistle the music that plays when fresh bread comes out.',
        'type': 'music',
        'difficulty': 'easy',
    },
]

VALID_TYPES = {c[0] for c in Challenge.CHALLENGE_TYPES}
VALID_DIFFICULTY = {c[0] for c in Challenge.DIFFICULTY_CHOICES}


def _parse_ai_payload(raw: str) -> dict | None:
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
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    if not isinstance(data, dict):
        return None
    title = str(data.get('title') or '').strip()[:200]
    description = str(data.get('description') or '').strip()[:500]
    ctype = str(data.get('type') or 'writing').strip().lower()
    difficulty = str(data.get('difficulty') or 'easy').strip().lower()
    if not title:
        return None
    if ctype not in VALID_TYPES:
        ctype = 'writing'
    if difficulty not in VALID_DIFFICULTY:
        difficulty = 'easy'
    return {
        'title': title,
        'description': description or 'A bright creative prompt for today.',
        'type': ctype,
        'difficulty': difficulty,
    }


def generate_daily_challenge_payload(*, language: str = 'en') -> dict:
    """Return title/description/type/difficulty — AI first, then curated fallback."""
    lang_line = 'Write title and description in Arabic.' if language == 'ar' else 'Write title and description in English.'
    recent = list(
        Challenge.objects.filter(is_daily=True)
        .order_by('-created_at')
        .values_list('title', flat=True)[:8]
    )
    avoid = ''
    if recent:
        avoid = ' Do not repeat these titles: ' + ' | '.join(recent) + '.'
    raw = llm_text(
        DAILY_SYSTEM,
        f'{lang_line} Make it feel fresh for today.{avoid} Return JSON only.',
        max_tokens=220,
        temperature=0.85,
    )
    parsed = _parse_ai_payload(raw or '')
    if parsed:
        parsed['is_ai_generated'] = True
        return parsed
    pick = dict(random.choice(POSITIVE_FALLBACKS))
    pick['is_ai_generated'] = False
    return pick


def ensure_today_daily(*, language: str = 'en', force: bool = False) -> Challenge:
    """Return today's daily challenge, creating one if needed."""
    now = timezone.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    existing = (
        Challenge.objects.filter(is_daily=True, is_active=True, created_at__gte=start)
        .order_by('-created_at')
        .first()
    )
    if existing and not force:
        return existing

    payload = generate_daily_challenge_payload(language=language)
    # Archive previous dailies so only one active daily shows.
    Challenge.objects.filter(is_daily=True, is_active=True).update(is_daily=False)

    return Challenge.objects.create(
        title=payload['title'],
        description=payload['description'],
        type=payload['type'],
        difficulty=payload['difficulty'],
        is_daily=True,
        is_active=True,
        is_ai_generated=bool(payload.get('is_ai_generated')),
        created_by=None,
        end_date=start + timedelta(days=1),
        cover_url='',
    )
