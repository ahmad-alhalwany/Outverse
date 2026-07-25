"""Idea Constellation — linked Lab prompts, challenge hints, and deep links."""

from __future__ import annotations

import re

from django.db.models import Q

from challenges.models import Challenge
from questions.models import Question


_CATEGORY_TO_CHALLENGE = {
    'technology': 'experimental',
    'design': 'art',
    'writing': 'writing',
    'art': 'art',
    'education': 'practical',
    'environment': 'practical',
    'health': 'practical',
    'social': 'practical',
    'other': 'experimental',
}


def _keywords(idea) -> list[str]:
    tags = [str(t).strip().lower() for t in (idea.tags or []) if str(t).strip()]
    title_words = [
        w.lower()
        for w in re.split(r'\W+', idea.title or '')
        if len(w) > 3
    ]
    seen: set[str] = set()
    out: list[str] = []
    for word in tags + title_words[:6]:
        if word and word not in seen:
            seen.add(word)
            out.append(word)
    return out


def _match_questions(keywords: list[str], limit: int = 5) -> list[Question]:
    if not keywords:
        return list(Question.objects.filter(is_active=True).order_by('-times_answered')[:limit])
    query = Q()
    for kw in keywords[:8]:
        query |= Q(text__icontains=kw)
        query |= Q(tags__icontains=kw)
    return list(
        Question.objects.filter(is_active=True)
        .filter(query)
        .distinct()
        .order_by('-times_answered')[:limit]
    )


def _placeholder_questions(tags: list[str]) -> list[dict]:
    rows = []
    for tag in tags[:3]:
        label = str(tag).strip().lstrip('#')
        if not label:
            continue
        rows.append({
            'id': None,
            'text': f'What would it look like if #{label} became the heart of this idea?',
            'placeholder': True,
        })
    return rows


def build_idea_constellation(idea) -> dict:
    keywords = _keywords(idea)
    tags = [str(t).strip() for t in (idea.tags or []) if str(t).strip()]
    matched = _match_questions(keywords)

    questions = [
        {'id': q.id, 'text': q.text, 'category': q.category, 'placeholder': False}
        for q in matched
    ]
    if not questions:
        questions = _placeholder_questions(tags or keywords[:3])

    challenge_hint = None
    ch_type = _CATEGORY_TO_CHALLENGE.get(idea.category, 'experimental')
    challenge = (
        Challenge.objects.filter(is_active=True, type=ch_type)
        .order_by('-is_daily', '-created_at')
        .first()
    )
    if challenge:
        challenge_hint = {
            'id': challenge.id,
            'title': challenge.title,
            'type': challenge.type,
        }

    idea_id = idea.id
    return {
        'idea_id': idea_id,
        'keywords': keywords[:8],
        'questions': questions,
        'challenge_hint': challenge_hint,
        'deep_links': {
            'lab': '/lab',
            'bottle_create': f'/bottles?idea_id={idea_id}&compose=1',
            'capsule_create': f'/capsules?idea_id={idea_id}',
        },
    }
