"""Generate creative prompts with an optional LLM provider.

The generator is **best-effort**: if no provider is configured or the
request fails, callers fall back to the curated question bank. Set one of:
``NVIDIA_API_KEY`` (NIM), ``OPENAI_API_KEY``, or ``ANTHROPIC_API_KEY``.

Generated questions are persisted to the Question table with
``is_generated=True`` so they appear in the same dedup + rotation logic
as hand-curated ones — and so the admin can review / remove anything
off-brand.
"""

from __future__ import annotations

import json
import os
from typing import Iterable

import requests

from .models import Question

# Tone guardrails — keep Outverse's signature weird-but-warm voice.
SYSTEM_PROMPT = (
    "You are the creative prompt engine for Outverse, a social app where people "
    "post creative responses to unusual questions. Generate ONE question that "
    "is imaginative, specific, slightly strange, and answerable in a short post. "
    "Avoid generic prompts like 'what are you thinking?'. Prefer what-ifs, "
    "hypotheticals, sensory details, and a touch of wonder or mystery. "
    "Maximum 30 words. No quotation marks. No preamble."
)

NVIDIA_CHAT_URL = os.environ.get(
    'NVIDIA_API_BASE',
    'https://integrate.api.nvidia.com/v1',
).rstrip('/') + '/chat/completions'


def _provider() -> str | None:
    # Prefer NVIDIA when present (Cosmory local default free path).
    if os.environ.get('NVIDIA_API_KEY'):
        return 'nvidia'
    if os.environ.get('OPENAI_API_KEY'):
        return 'openai'
    if os.environ.get('ANTHROPIC_API_KEY'):
        return 'anthropic'
    return None


def _recent_texts(user, language: str, limit: int = 12) -> list[str]:
    if not user or not user.is_authenticated:
        return []
    qs = Question.objects.filter(language=language).order_by('-id')[:limit]
    return [q.text for q in qs]


def _build_user_prompt(
    *,
    language: str,
    category: str | None,
    interests: Iterable[str],
    avoid: Iterable[str],
    preferred_categories: Iterable[str] = (),
) -> str:
    parts = [f"Write the question in {'Arabic' if language == 'ar' else 'English'}."]
    if category and category != 'all':
        parts.append(f"Category: {category}.")
    preferred_list = [c for c in preferred_categories if c][:3]
    if preferred_list:
        parts.append("Lean into these taste categories: " + ", ".join(preferred_list) + ".")
    interests_list = [i for i in interests if isinstance(i, str) and i.strip()][:5]
    if interests_list:
        parts.append("The user is interested in: " + ", ".join(interests_list) + ".")
    avoid_list = [a for a in avoid if a][:8]
    if avoid_list:
        parts.append("Do NOT generate any of these (already asked): " + " | ".join(avoid_list))
    parts.append("Return ONLY the question text, nothing else.")
    return " ".join(parts)


def _openai_compatible_chat(
    *,
    url: str,
    api_key: str,
    model: str,
    system: str,
    user_prompt: str,
    max_tokens: int,
    temperature: float,
) -> str | None:
    try:
        res = requests.post(
            url,
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={
                'model': model,
                'messages': [
                    {'role': 'system', 'content': system},
                    {'role': 'user', 'content': user_prompt},
                ],
                'temperature': temperature,
                'max_tokens': max_tokens,
            },
            timeout=45,
        )
        res.raise_for_status()
        text = res.json()['choices'][0]['message']['content'].strip()
        return text or None
    except Exception:
        return None


def _call_nvidia(system: str, user_prompt: str, *, max_tokens: int = 80, temperature: float = 0.9) -> str | None:
    key = os.environ.get('NVIDIA_API_KEY')
    if not key:
        return None
    model = os.environ.get('NVIDIA_MODEL', 'meta/llama-3.1-8b-instruct')
    return _openai_compatible_chat(
        url=NVIDIA_CHAT_URL,
        api_key=key,
        model=model,
        system=system,
        user_prompt=user_prompt,
        max_tokens=max_tokens,
        temperature=temperature,
    )


def _call_openai(system: str, user_prompt: str, *, max_tokens: int = 80, temperature: float = 0.9) -> str | None:
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return None
    return _openai_compatible_chat(
        url='https://api.openai.com/v1/chat/completions',
        api_key=key,
        model=os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
        system=system,
        user_prompt=user_prompt,
        max_tokens=max_tokens,
        temperature=temperature,
    )


def _call_anthropic(system: str, user_prompt: str, *, max_tokens: int = 80, temperature: float = 0.9) -> str | None:
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key:
        return None
    try:
        res = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            json={
                'model': os.environ.get('ANTHROPIC_MODEL', 'claude-3-5-haiku-latest'),
                'max_tokens': max_tokens,
                'temperature': temperature,
                'system': system,
                'messages': [{'role': 'user', 'content': user_prompt}],
            },
            timeout=45,
        )
        res.raise_for_status()
        blocks = res.json().get('content', [])
        text = ''.join(b.get('text', '') for b in blocks if b.get('type') == 'text').strip()
        return text or None
    except Exception:
        return None


def llm_text(system: str, user_prompt: str, *, max_tokens: int = 80, temperature: float = 0.9) -> str | None:
    """Call the configured provider; return None if unavailable."""
    provider = _provider()
    if provider == 'nvidia':
        return _call_nvidia(system, user_prompt, max_tokens=max_tokens, temperature=temperature)
    if provider == 'openai':
        return _call_openai(system, user_prompt, max_tokens=max_tokens, temperature=temperature)
    if provider == 'anthropic':
        return _call_anthropic(system, user_prompt, max_tokens=max_tokens, temperature=temperature)
    return None


def generate_question(
    *,
    language: str = 'en',
    category: str | None = None,
    interests: Iterable[str] = (),
    avoid: Iterable[str] = (),
    preferred_categories: Iterable[str] = (),
) -> str | None:
    """Return generated question text, or ``None`` if unavailable."""
    if _provider() is None:
        return None
    user_prompt = _build_user_prompt(
        language=language,
        category=category,
        interests=interests,
        avoid=avoid,
        preferred_categories=preferred_categories,
    )
    text = llm_text(SYSTEM_PROMPT, user_prompt)
    if not text:
        return None
    # Clean common wrappers
    text = text.strip().strip('"').strip("'").strip('«').strip('»').strip()
    if len(text) > 240:
        text = text[:237].rstrip() + '...'
    return text


# ---- Writing Buddy: mid-draft reflective prompts ----
BUDDY_SYSTEM_PROMPT = (
    "You are a gentle writing companion inside Outverse, a creative social app. "
    "The user is mid-post. Read what they have so far and ask ONE short reflective "
    "question that opens an angle they haven't explored — a sensory detail, a "
    "memory, a what-if, a feeling beneath the surface. "
    "Do NOT write for them. Do NOT summarize. Just one question. Max 22 words. "
    "No quotation marks. No preamble."
)

BUDDY_FALLBACKS_EN = [
    "What did this feel like in your body?",
    "Where does this memory begin, exactly?",
    "If this were a scene in a film, what would the camera show first?",
    "What did you not say here — and why?",
    "Whose voice comes to mind when you read this back?",
    "What would the younger you make of this?",
    "What's the smallest detail you haven't mentioned yet?",
    "If this had a temperature, what would it be?",
    "What are you leaving out to seem more put-together?",
    "What does this want to become that you haven't let it?",
]

BUDDY_FALLBACKS_AR = [
    'ما الذي شعرت به في جسدك وأنت تكتب هذا؟',
    'أين تبدأ هذه اللحظة بالضبط؟',
    'لو كانت هذه لقطة في فيلم، ماذا تُظهر الكاميرا أولاً؟',
    'ما الذي لم تقله هنا — ولماذا؟',
    'صوت من يأتيك حين تقرأ هذا من جديد؟',
    'ماذا كان سيقول نسخة أصغر منك عن هذا؟',
    'ما أدق تفصيلة لم تذكرها بعد؟',
    'لو كان لهذا حرارة، كم ستكون؟',
    'ما الذي تُسقطه لتبدو أكثر تماسكاً؟',
    'إلى ماذا يطمح هذا النص ولم تسمح له به بعد؟',
]


def _build_buddy_prompt(draft_text: str, language: str, interests: Iterable[str] = ()) -> str:
    is_ar = language == 'ar'
    parts = [
        f"Respond in {'Arabic' if is_ar else 'English'}.",
        f"The user's draft so far:\n\"\"\"\n{draft_text[:1200]}\n\"\"\"\n",
    ]
    interest_list = [i for i in interests if isinstance(i, str) and i.strip()][:5]
    if interest_list:
        parts.append("The writer cares about: " + ", ".join(interest_list) + ".")
    parts.append("Ask ONE reflective question that deepens what they're writing.")
    parts.append("Return ONLY the question, nothing else.")
    return " ".join(parts)


def deepen_draft(*, draft_text: str, language: str = 'en', interests: Iterable[str] = ()) -> str | None:
    """Return a single reflective question about the user's draft.

    Falls back to a curated prompt when no LLM provider is configured or
    the call fails — the buddy always answers, just with less specificity.
    """
    draft = (draft_text or '').strip()
    if not draft:
        return None

    if _provider() is not None:
        buddy_prompt = _build_buddy_prompt(draft, language, interests)
        text = llm_text(BUDDY_SYSTEM_PROMPT, buddy_prompt)
        if text:
            text = text.strip().strip('"').strip("'").strip('«').strip('»').strip()
            if len(text) > 200:
                text = text[:197].rstrip() + '...'
            return text

    # Fallback: deterministic pick from the curated bank so the same draft
    # always yields the same prompt (feels intentional, not random).
    import hashlib
    bank = BUDDY_FALLBACKS_AR if language == 'ar' else BUDDY_FALLBACKS_EN
    digest = hashlib.sha256(draft.encode()).hexdigest()
    return bank[int(digest, 16) % len(bank)]


def persist_generated(text: str, *, language: str, category: str | None = 'surreal') -> Question:
    """Save a generated question so it joins the normal rotation/dedup flow."""
    cat = category if category in dict(Question.CATEGORY_CHOICES) else 'surreal'
    question, _ = Question.objects.get_or_create(
        text=text,
        language=language,
        defaults={
            'category': cat,
            'tags': ['ai-generated'],
            'is_active': True,
            'is_generated': True,
        },
    )
    return question
