"""Community Constellation — linked Lab prompts for a community, mirroring ideas/constellation.py."""

from __future__ import annotations

import re

from ideas.constellation import _match_questions, _placeholder_questions


def _keywords(community) -> list[str]:
    flairs = [str(f).strip().lower() for f in (community.flair_options or []) if str(f).strip()]
    name_words = [
        w.lower()
        for w in re.split(r'\W+', community.name or '')
        if len(w) > 3
    ]
    seen: set[str] = set()
    out: list[str] = []
    for word in flairs + name_words[:6]:
        if word and word not in seen:
            seen.add(word)
            out.append(word)
    return out


def build_community_constellation(community) -> dict:
    keywords = _keywords(community)
    flairs = [str(f).strip() for f in (community.flair_options or []) if str(f).strip()]
    matched = _match_questions(keywords)

    questions = [
        {'id': q.id, 'text': q.text, 'category': q.category, 'placeholder': False}
        for q in matched
    ]
    if not questions:
        questions = _placeholder_questions(flairs)

    return {
        'community_id': community.id,
        'keywords': keywords,
        'questions': questions,
        'deep_links': {
            'lab': '/lab',
        },
    }
