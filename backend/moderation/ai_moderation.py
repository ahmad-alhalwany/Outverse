"""
AI Moderation Service using the OpenAI Moderation API, with an NVIDIA NIM
(NemoGuard content-safety) fallback for when no OpenAI key is configured.

Usage in views:
    from moderation.ai_moderation import auto_moderate
    result = auto_moderate(text, content_type='post', object_id=post.id, user=user)
    if result['flagged']:
        # content auto-hidden, user notified
        ...
"""
from __future__ import annotations

import json
import logging
from typing import Optional

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Category mapping from OpenAI to our internal categories
OPENAI_TO_INTERNAL = {
    'sexual': 'sexual',
    'sexual/minors': 'child_sexual_abuse',
    'hate': 'hate',
    'hate/threatening': 'hate_threatening',
    'harassment': 'harassment',
    'harassment/threatening': 'harassment_threatening',
    'self-harm': 'self_harm',
    'self-harm/intent': 'self_harm_intent',
    'self-harm/instructions': 'self_harm_instructions',
    'violence': 'violence',
    'violence/graphic': 'violence_graphic',
}

# NVIDIA NemoGuard's documented S1-S23 safety taxonomy, mapped to internal
# category names (aligned with OPENAI_TO_INTERNAL's naming where the concepts
# overlap, so FlaggedContent.ai_categories reads consistently regardless of
# which provider produced the result).
NVIDIA_SAFETY_CATEGORIES = {
    'S1': ('violence', 'Violence'),
    'S2': ('sexual', 'Sexual'),
    'S3': ('criminal_planning', 'Criminal Planning/Confessions'),
    'S4': ('weapons', 'Guns and Illegal Weapons'),
    'S5': ('controlled_substances', 'Controlled/Regulated Substances'),
    'S6': ('self_harm', 'Suicide and Self Harm'),
    'S7': ('child_sexual_abuse', 'Sexual (minor)'),
    'S8': ('hate', 'Hate/Identity Hate'),
    'S9': ('pii_privacy', 'PII/Privacy'),
    'S10': ('harassment', 'Harassment'),
    'S11': ('threat', 'Threat'),
    'S12': ('profanity', 'Profanity'),
    'S13': ('needs_caution', 'Needs Caution'),
    'S14': ('other', 'Other'),
    'S15': ('manipulation', 'Manipulation'),
    'S16': ('fraud_deception', 'Fraud/Deception'),
    'S17': ('malware', 'Malware'),
    'S18': ('high_risk_gov', 'High Risk Gov Decision Making'),
    'S19': ('misinformation', 'Political/Misinformation/Conspiracy'),
    'S20': ('copyright', 'Copyright/Trademark/Plagiarism'),
    'S21': ('unauthorized_advice', 'Unauthorized Advice'),
    'S22': ('illegal_activity', 'Illegal Activity'),
    'S23': ('immoral_unethical', 'Immoral/Unethical'),
}

NVIDIA_CONTENT_SAFETY_MODEL = 'nvidia/llama-3.1-nemoguard-8b-content-safety'

# The model doesn't always follow the "S1, S2, ..." code format the prompt
# requests — it sometimes returns the full category name instead. Look up by
# either form (code or name, case-insensitive).
NVIDIA_CATEGORY_LOOKUP = {}
for _code, (_internal, _name) in NVIDIA_SAFETY_CATEGORIES.items():
    NVIDIA_CATEGORY_LOOKUP[_code.lower()] = _internal
    NVIDIA_CATEGORY_LOOKUP[_name.lower()] = _internal

# Content types that map to FlaggedContent.CONTENT_TYPES
VALID_CONTENT_TYPES = frozenset({
    'post', 'comment', 'reel', 'reel_comment', 'story', 'live_chat',
    'chat_message', 'room_message', 'bottle',
})


def _moderate_with_nvidia(text: str) -> dict:
    """Fallback moderation via NVIDIA's NemoGuard content-safety NIM, used
    when no OpenAI key is configured. NVIDIA doesn't expose a dedicated
    /moderations endpoint like OpenAI — NemoGuard is called as a regular
    chat-completion using its documented safety-classification prompt."""
    api_key = getattr(settings, 'NVIDIA_API_KEY', '')
    if not api_key:
        return {
            'flagged': False,
            'categories': {},
            'category_scores': {},
            'model': 'none',
            'error': 'No NVIDIA_API_KEY configured',
        }

    categories_block = "\n".join(f"{code}: {name}." for code, (_, name) in NVIDIA_SAFETY_CATEGORIES.items())
    prompt = (
        "Task: Check if there is unsafe content in the user message in the below "
        "conversation in accordance with our safety policy with the below categories.\n"
        f"<BEGIN UNSAFE CONTENT CATEGORIES>\n{categories_block}\n<END UNSAFE CONTENT CATEGORIES>\n"
        "<BEGIN CONVERSATION>\n"
        f"user: {text[:4000]}\n"
        "<END CONVERSATION>\n"
        "Provide your safety assessment in JSON format: "
        '{"User Safety": safe or unsafe, "Safety Categories": comma-separated list}. '
        "Output JSON only."
    )

    try:
        response = requests.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": NVIDIA_CONTENT_SAFETY_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
                "max_tokens": 128,
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        content = data['choices'][0]['message']['content']
        verdict = json.loads(content)

        flagged = str(verdict.get('User Safety', 'safe')).strip().lower() == 'unsafe'
        raw_codes = verdict.get('Safety Categories', '') if flagged else ''
        codes = [c.strip() for c in str(raw_codes).split(',') if c.strip()]

        categories = {}
        for raw in codes:
            key = raw.strip().lower()
            internal = NVIDIA_CATEGORY_LOOKUP.get(key) or key.replace(' ', '_').replace('/', '_')
            categories[internal] = True

        return {
            'flagged': flagged,
            'categories': categories,
            'category_scores': {},
            'model': NVIDIA_CONTENT_SAFETY_MODEL,
        }
    except (requests.RequestException, KeyError, IndexError, ValueError) as e:
        logger.warning("NVIDIA moderation API error: %s", e)
        return {
            'flagged': False,
            'categories': {},
            'category_scores': {},
            'model': 'error',
            'error': str(e),
        }


def moderate_text(text: str, model: str = "text-moderation-latest") -> dict:
    """
    Send text to OpenAI's Moderation API, falling back to NVIDIA's NemoGuard
    content-safety NIM if no OpenAI key is configured.

    Returns dict with:
        - flagged: bool
        - categories: dict[str, bool]
        - category_scores: dict[str, float]
        - model: str
        - error: str (only if something went wrong)
    """
    api_key = getattr(settings, 'OPENAI_API_KEY', '')

    if not api_key:
        return _moderate_with_nvidia(text)

    try:
        response = requests.post(
            "https://api.openai.com/v1/moderations",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={"input": text[:8000], "model": model},  # OpenAI max 32k, we cap at 8k
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        result = data['results'][0]

        categories = {}
        scores = {}
        for cat, flagged in result.get('categories', {}).items():
            internal = OPENAI_TO_INTERNAL.get(cat, cat)
            categories[internal] = flagged
        for cat, score in result.get('category_scores', {}).items():
            internal = OPENAI_TO_INTERNAL.get(cat, cat)
            scores[internal] = score

        return {
            'flagged': result.get('flagged', False),
            'categories': categories,
            'category_scores': scores,
            'model': result.get('model', model),
        }
    except requests.RequestException as e:
        logger.warning("OpenAI moderation API error: %s", e)
        return {
            'flagged': False,
            'categories': {},
            'category_scores': {},
            'model': 'error',
            'error': str(e),
        }


def auto_moderate(
    text: str,
    content_type: str,
    object_id: Optional[int] = None,
    user=None,
    reporter: str = 'ai_moderation',
    result: Optional[dict] = None,
) -> dict:
    """
    Moderate a content object and save results to FlaggedContent.

    Always creates a record for audit trail — flagged or not.
    Called from content creation endpoints (posts, reels, stories, comments).

    Pass an already-computed ``result`` (from a prior ``moderate_text()`` call)
    to avoid re-hitting the OpenAI API — callers that pre-check content before
    saving and then log the outcome after saving should reuse the same result
    rather than moderating the same text twice.

    Returns:
        dict with 'flagged', 'categories', 'category_scores', 'model',
        and optionally 'error'.
    """
    from moderation.models import FlaggedContent

    if content_type not in VALID_CONTENT_TYPES:
        logger.warning("Invalid content_type %r", content_type)
        content_type = 'post'  # safe fallback

    if result is None:
        result = moderate_text(text)

    if result.get('error'):
        # Don't block content if moderation service fails — KISS
        logger.warning("Moderation failed, allowing content: %s", result['error'])

    FlaggedContent.objects.create(
        type=content_type,
        object_id=object_id,
        content=text[:1000],
        reporter=reporter,
        user=user,
        status='auto_flagged' if result.get('flagged') else 'approved',
        ai_flagged=result.get('flagged', False),
        ai_categories=result.get('categories', {}),
        ai_scores=result.get('category_scores', {}),
        ai_model=result.get('model', ''),
        ai_checked_at=timezone.now(),
    )

    return result


def is_content_blocked(text: str) -> bool:
    """
    Fast check: should this content be blocked before saving?
    Use only when you need a yes/no before persisting content.
    """
    result = moderate_text(text)
    return result.get('flagged', False) and not result.get('error')
