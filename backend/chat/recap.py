"""Generate a sealed recap for an expired Prompt Room.

Heuristic by default — no LLM required. When a provider is configured,
``summarize_room`` asks the LLM for a single reflective closing line; on
any failure it falls back to a templated sentence so the recap always
renders.
"""
from __future__ import annotations

from typing import Any

from django.utils import timezone

from .models import ChatRoom, RoomMessage, RoomRecap


def _top_messages(room: ChatRoom, limit: int = 3) -> list[dict[str, Any]]:
    """Pick the most substantive messages — longest text first, tie-break
    by earliest. Skips empty/very-short messages and the room creator's
    own opening if it dominates the room.
    """
    msgs = list(
        room.messages
        .exclude(text='')
        .exclude(text__isnull=True)
        .order_by('-text', 'created_at')[: limit * 3]
    )
    # Filter to messages with at least 24 chars when possible, else relax.
    long = [m for m in msgs if len(m.text) >= 24]
    pool = long if len(long) >= limit else msgs
    chosen = pool[:limit]
    # Sort final selection chronologically for a natural reading order.
    chosen.sort(key=lambda m: m.created_at)
    return [
        {
            'id': m.id,
            'sender_id': m.sender_id,
            'sender_name': _display_name(m.sender),
            'text': m.text,
            'created_at': m.created_at.isoformat(),
            'chars': len(m.text),
        }
        for m in chosen
    ]


def _display_name(user) -> str:
    full = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full or user.username


def _template_summary(room: ChatRoom, recap_data: dict) -> str:
    p = recap_data['participant_count']
    m = recap_data['message_count']
    top = recap_data['top_messages']
    longest = top[0]['chars'] if top else 0
    if m == 0:
        return "This room stayed quiet — a question that waited for someone to begin."
    if p <= 1:
        return f"One voice sat with this question and wrote {m} message{'s' if m != 1 else ''}."
    return (
        f"{p} people gathered around this question and shared {m} messages. "
        f"The longest reflection was {longest} characters."
    )


def _llm_summary(room: ChatRoom, recap_data: dict) -> str | None:
    try:
        from questions.llm import _provider, _call_openai, _call_anthropic
    except Exception:
        return None
    if _provider() is None:
        return None
    question = room.question.text if room.question else room.name
    snippets = " | ".join(f'"{m["text"][:160]}"' for m in recap_data['top_messages'][:3])
    user_prompt = (
        f"A 24-hour conversation room on Outverse just closed. The question was:\n"
        f'"{question}"\n\n'
        f"The most substantive messages were:\n{snippets}\n\n"
        "Write ONE reflective sentence (max 28 words) that closes the room with "
        "warmth — what these people reached for together. No quotes, no preamble."
    )
    system = (
        "You are the closing voice of a creative conversation space. "
        "Write a single tender, specific sentence that honors what was shared."
    )
    try:
        text = (
            _call_openai(system, user_prompt)
            if _provider() == 'openai'
            else _call_anthropic(system, user_prompt)
        )
    except Exception:
        return None
    if not text:
        return None
    text = text.strip().strip('"').strip("'").strip('«').strip('»').strip()
    if len(text) > 240:
        text = text[:237].rstrip() + '...'
    return text


def build_recap_data(room: ChatRoom) -> dict:
    msgs_qs = room.messages.all()
    participant_count = (
        msgs_qs.values('sender_id').distinct().count() or room.members.count()
    )
    message_count = msgs_qs.count()
    duration_minutes = 0
    if room.expires_at and room.created_at:
        delta = room.expires_at - room.created_at
        duration_minutes = max(0, int(delta.total_seconds() // 60))
    top = _top_messages(room)
    return {
        'participant_count': participant_count,
        'message_count': message_count,
        'top_messages': top,
        'duration_minutes': duration_minutes,
    }


def get_or_build_recap(room: ChatRoom) -> RoomRecap:
    """Return the cached recap, or build + persist one for an expired room."""
    recap = getattr(room, 'recap', None)
    if recap:
        return recap

    data = build_recap_data(room)
    summary = _llm_summary(room, data) or _template_summary(room, data)
    recap = RoomRecap.objects.create(
        room=room,
        participant_count=data['participant_count'],
        message_count=data['message_count'],
        top_messages=data['top_messages'],
        duration_minutes=data['duration_minutes'],
        summary=summary,
    )
    return recap
