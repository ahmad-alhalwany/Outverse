"""Outverse creative AI coaches — best-effort LLM helpers with local fallbacks.

Reuses the same providers as ``questions.llm`` (OPENAI_API_KEY / ANTHROPIC_API_KEY).
Every function returns a dict suitable for JSON API responses and never raises
on provider failure.
"""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from questions.llm import llm_text


def _lang_label(language: str) -> str:
    return 'Arabic' if language == 'ar' else 'English'


def _parse_json(text: str | None) -> dict | list | None:
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith('```'):
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        cleaned = re.sub(r'\s*```$', '', cleaned)
    try:
        return json.loads(cleaned)
    except Exception:
        # Try to extract first {…} or […]
        for opener, closer in (('{', '}'), ('[', ']')):
            start = cleaned.find(opener)
            end = cleaned.rfind(closer)
            if start >= 0 and end > start:
                try:
                    return json.loads(cleaned[start : end + 1])
                except Exception:
                    pass
    return None


def _pick(bank: list[str], seed: str) -> str:
    digest = hashlib.sha256(seed.encode()).hexdigest()
    return bank[int(digest, 16) % len(bank)]


# ── 1) Idea Coach ────────────────────────────────────────────────────────────

IDEA_COACH_SYSTEM = (
    "You are the Idea Coach for Outverse Bazaar — a creative collaboration marketplace. "
    "Given a rough idea draft, return ONLY valid JSON with keys: "
    "title (clearer short title, max 8 words), "
    "milestones (array of 3 short milestone strings), "
    "constellation_questions (array of exactly 3 imaginative short questions that deepen the idea). "
    "No markdown. No preamble."
)


def coach_idea(*, title: str = '', description: str = '', language: str = 'en') -> dict[str, Any]:
    title = (title or '').strip()
    description = (description or '').strip()
    seed = f'{title}|{description}|{language}'
    fallback = {
        'title': title or ('فكرة أوضح' if language == 'ar' else 'A clearer idea title'),
        'milestones': (
            ['حدد أول تجربة صغيرة', 'ادعُ متعاونًا واحدًا', 'انشر تحديثًا أسبوعيًا']
            if language == 'ar'
            else ['Ship a tiny first experiment', 'Invite one collaborator', 'Share a weekly update']
        ),
        'constellation_questions': (
            [
                'ما الشعور الذي تريد أن يعيشه الناس مع هذه الفكرة؟',
                'لو نجحت بعد شهر، ماذا سيكون مختلفًا؟',
                'ما أصغر خطوة يمكن أن يبدأها شخص غريب غدًا؟',
            ]
            if language == 'ar'
            else [
                'What feeling should people leave with?',
                'If this works in a month, what changed?',
                'What is the smallest step a stranger could take tomorrow?',
            ]
        ),
        'source': 'fallback',
    }
    if not title and not description:
        return fallback

    user_prompt = (
        f"Respond in {_lang_label(language)}. "
        f"Draft title: {title or '(none)'}\n"
        f"Draft description:\n{(description or '(none)')[:1500]}\n"
        "Return JSON only."
    )
    raw = llm_text(IDEA_COACH_SYSTEM, user_prompt, max_tokens=400, temperature=0.7)
    data = _parse_json(raw)
    if not isinstance(data, dict):
        return fallback

    out_title = str(data.get('title') or fallback['title']).strip()[:120]
    milestones = data.get('milestones') or fallback['milestones']
    questions = data.get('constellation_questions') or fallback['constellation_questions']
    if not isinstance(milestones, list):
        milestones = fallback['milestones']
    if not isinstance(questions, list):
        questions = fallback['constellation_questions']
    return {
        'title': out_title or fallback['title'],
        'milestones': [str(m).strip()[:120] for m in milestones[:3]],
        'constellation_questions': [str(q).strip()[:180] for q in questions[:3]],
        'source': 'llm' if raw else 'fallback',
    }


# ── 2) Remix Meaning ─────────────────────────────────────────────────────────

REMIX_SYSTEM = (
    "You help creators on Outverse make meaningful reel remixes. "
    "Return ONLY JSON with keys: hook (max 12 words), caption (max 40 words), "
    "why_it_matters (1 short sentence on why this remix has meaning). "
    "No markdown. No preamble."
)


def remix_meaning(
    *,
    source_label: str = '',
    source_text: str = '',
    draft_caption: str = '',
    language: str = 'en',
) -> dict[str, Any]:
    source_label = (source_label or 'inspiration').strip()
    source_text = (source_text or '').strip()
    draft_caption = (draft_caption or '').strip()
    fallback = {
        'hook': 'This started as a question — watch what grew.' if language != 'ar' else 'بدأت كسؤال — انظر ماذا نمت.',
        'caption': (
            draft_caption
            or (
                f'Remixing {source_label}: carrying the spark forward.'
                if language != 'ar'
                else f'إعادة مزج {source_label}: أحمل الشرارة أبعد.'
            )
        ),
        'why_it_matters': (
            'Remix with meaning turns inspiration into a new voice, not a copy.'
            if language != 'ar'
            else 'إعادة المزج ذات المعنى تحوّل الإلهام إلى صوت جديد لا نسخة.'
        ),
        'source': 'fallback',
    }
    user_prompt = (
        f"Respond in {_lang_label(language)}. "
        f"Source type/label: {source_label}\n"
        f"Source text:\n{source_text[:1200] or '(none)'}\n"
        f"Draft caption:\n{draft_caption[:500] or '(none)'}\n"
        "Return JSON only."
    )
    raw = llm_text(REMIX_SYSTEM, user_prompt, max_tokens=280, temperature=0.75)
    data = _parse_json(raw)
    if not isinstance(data, dict):
        return fallback
    return {
        'hook': str(data.get('hook') or fallback['hook']).strip()[:100],
        'caption': str(data.get('caption') or fallback['caption']).strip()[:280],
        'why_it_matters': str(data.get('why_it_matters') or fallback['why_it_matters']).strip()[:220],
        'source': 'llm' if raw else 'fallback',
    }


# ── 3) Capsule / Bottle tone ─────────────────────────────────────────────────

TONE_SYSTEM = (
    "You gently polish emotional writing for Outverse Vault (bottles & capsules). "
    "Keep the writer's meaning and voice. Soften harsh edges only if asked. "
    "Return ONLY JSON with keys: polished (improved text), note (one short tip). "
    "Do not add hashtags or emojis unless already present. No markdown."
)


def polish_tone(*, text: str, kind: str = 'bottle', language: str = 'en') -> dict[str, Any]:
    text = (text or '').strip()
    if not text:
        return {'polished': '', 'note': 'Write something first.', 'source': 'fallback'}
    fallback_note = (
        'أبقيت المعنى أوضح قليلًا — راجع قبل الإرسال.'
        if language == 'ar'
        else 'Kept your meaning, made the edges a little clearer — review before sending.'
    )
    fallback = {'polished': text, 'note': fallback_note, 'source': 'fallback'}
    user_prompt = (
        f"Respond in {_lang_label(language)}. "
        f"This is a {kind} message.\n"
        f"Original:\n\"\"\"\n{text[:2000]}\n\"\"\"\n"
        "Return JSON only."
    )
    raw = llm_text(TONE_SYSTEM, user_prompt, max_tokens=500, temperature=0.55)
    data = _parse_json(raw)
    if not isinstance(data, dict):
        return fallback
    polished = str(data.get('polished') or text).strip()
    if not polished:
        return fallback
    return {
        'polished': polished[:4000],
        'note': str(data.get('note') or fallback_note).strip()[:180],
        'source': 'llm' if raw else 'fallback',
    }


# ── 4) Live Host Assist ──────────────────────────────────────────────────────

HOST_ASSIST_SYSTEM = (
    "You are a live-stream host assistant for Outverse. "
    "Suggest exactly 3 short audience-engagement questions for the host to ask. "
    "Return ONLY JSON: {\"questions\": [\"...\", \"...\", \"...\"]}. No markdown."
)

HOST_RECAP_SYSTEM = (
    "You write a warm one-paragraph recap of a finished Outverse live session "
    "from chat snippets and title. Return ONLY plain text, max 60 words. "
    "No markdown. No preamble."
)


def live_host_prompts(*, title: str = '', description: str = '', language: str = 'en') -> dict[str, Any]:
    title = (title or 'Live').strip()
    description = (description or '').strip()
    fallback_q = (
        [
            'ما الذي أحضرتموه معي اليوم؟',
            'لو كان لهذا البث لون، ماذا يكون؟',
            'سؤال واحد تريدون أن أجيب عليه قبل أن ننتهي؟',
        ]
        if language == 'ar'
        else [
            'What brought you into this stream today?',
            'If this live had a color, what would it be?',
            'One question you want answered before we end?',
        ]
    )
    user_prompt = (
        f"Respond in {_lang_label(language)}. "
        f"Stream title: {title}\nDescription: {description[:600] or '(none)'}\n"
        "Return JSON only."
    )
    raw = llm_text(HOST_ASSIST_SYSTEM, user_prompt, max_tokens=220, temperature=0.8)
    data = _parse_json(raw)
    questions = fallback_q
    if isinstance(data, dict) and isinstance(data.get('questions'), list):
        qs = [str(q).strip()[:160] for q in data['questions'] if str(q).strip()]
        if len(qs) >= 3:
            questions = qs[:3]
    return {'questions': questions, 'source': 'llm' if raw and data else 'fallback'}


def live_host_recap(
    *,
    title: str = '',
    chat_snippets: list[str] | None = None,
    language: str = 'en',
) -> dict[str, Any]:
    title = (title or 'Live').strip()
    snippets = [s.strip() for s in (chat_snippets or []) if s and s.strip()][:12]
    fallback = {
        'summary': (
            f'انتهى البث «{title}» — بقيت منه أصوات قصيرة في الدردشة.'
            if language == 'ar'
            else f'The live “{title}” closed — a few voices lingered in chat.'
        ),
        'source': 'fallback',
    }
    joined = '\n'.join(f'- {s[:160]}' for s in snippets) or '(no chat)'
    user_prompt = (
        f"Respond in {_lang_label(language)}. "
        f"Title: {title}\nChat snippets:\n{joined}\n"
        "Write one warm closing paragraph."
    )
    raw = llm_text(HOST_RECAP_SYSTEM, user_prompt, max_tokens=140, temperature=0.6)
    if raw:
        text = raw.strip().strip('"').strip()
        if len(text) > 500:
            text = text[:497].rstrip() + '...'
        return {'summary': text, 'source': 'llm'}
    return fallback
