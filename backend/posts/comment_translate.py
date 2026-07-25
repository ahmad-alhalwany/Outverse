"""Best-effort comment translation via configured LLM provider."""

from __future__ import annotations

import os

import requests

SYSTEM_PROMPT = (
    "You translate social media comments for Outverse. Preserve tone, emojis, "
    "and @mentions. Return ONLY the translated text — no quotes, labels, or preamble."
)


def _provider() -> str | None:
    if os.environ.get('OPENAI_API_KEY'):
        return 'openai'
    if os.environ.get('ANTHROPIC_API_KEY'):
        return 'anthropic'
    return None


def _call_openai(system: str, user_prompt: str) -> str | None:
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        return None
    try:
        res = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
            json={
                'model': os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
                'messages': [
                    {'role': 'system', 'content': system},
                    {'role': 'user', 'content': user_prompt},
                ],
                'temperature': 0.3,
                'max_tokens': 500,
            },
            timeout=15,
        )
        res.raise_for_status()
        text = res.json()['choices'][0]['message']['content'].strip()
        return text or None
    except Exception:
        return None


def _call_anthropic(system: str, user_prompt: str) -> str | None:
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
                'max_tokens': 500,
                'system': system,
                'messages': [{'role': 'user', 'content': user_prompt}],
            },
            timeout=15,
        )
        res.raise_for_status()
        blocks = res.json().get('content', [])
        text = ''.join(b.get('text', '') for b in blocks if b.get('type') == 'text').strip()
        return text or None
    except Exception:
        return None


def translate_comment_text(text: str, target_lang: str) -> str | None:
    """Return translated comment text, or ``None`` if unavailable."""
    cleaned = (text or '').strip()
    if not cleaned or _provider() is None:
        return None
    lang = (target_lang or 'en').split('-')[0].lower()
    if lang not in ('en', 'ar'):
        return None
    lang_name = 'Arabic' if lang == 'ar' else 'English'
    user_prompt = f"Translate the following comment into {lang_name}:\n\n{cleaned[:2000]}"
    if _provider() == 'openai':
        return _call_openai(SYSTEM_PROMPT, user_prompt)
    return _call_anthropic(SYSTEM_PROMPT, user_prompt)
