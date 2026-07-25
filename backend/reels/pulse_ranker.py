"""Pulse ranking for reels — creativity-first For You (not pure chronology)."""

from __future__ import annotations

import math
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from analytics.feed_ranker import (
    DEFAULT_FEATURE_WEIGHTS,
    get_author_affinity,
    get_learned_feature_weights,
    get_tag_affinity,
    get_user_interest_vector,
)
from analytics.models import ContentEngagementEvent


def _normalize_tags(tags) -> set[str]:
    out = set()
    for raw in tags or []:
        name = str(raw).strip().lstrip('#').lower()
        if name:
            out.add(name)
    return out


def score_reel(
    reel,
    *,
    affinity: dict[int, float],
    following_ids: set[int],
    tag_affinity: dict[str, float],
    interest_vector: dict[str, float],
    feature_weights: dict[str, float],
    seen_ids: set[int],
    now,
) -> float:
    fw = feature_weights or DEFAULT_FEATURE_WEIGHTS
    age_hours = max(0.5, (now - reel.created_at).total_seconds() / 3600)
    recency = (36.0 / (age_hours + 4.0)) * fw.get('recency', 1.0)

    engagement = (
        (reel.likes_count or 0) * 2.4
        + (reel.comments_count or 0) * 3.2
        + (reel.shares_count or 0) * 4.0
        + (reel.views or 0) / 25.0
    ) * fw.get('base', 1.0)

    creativity = 0.0
    if reel.is_featured:
        creativity += 14.0
    if getattr(reel, 'inspiration_question_id', None) or getattr(reel, 'source_idea_id', None):
        creativity += 8.0
    if getattr(reel, 'remix_of_id', None) or getattr(reel, 'stitch_of_id', None):
        creativity += 5.0
    if getattr(reel, 'template_id', None):
        creativity += 4.0
    if (reel.filter_style or 'none') != 'none':
        creativity += 2.0
    if reel.captions_status == 'ready':
        creativity += 2.5
    effect = reel.effect_meta or {}
    if effect.get('backdrop') or effect.get('chroma_key'):
        creativity += 3.0
    tags = _normalize_tags(reel.tags)
    if len(tags) >= 2:
        creativity += 3.0
    creativity *= fw.get('creativity', 1.0)

    affinity_score = affinity.get(reel.user_id, 0.0) * 0.18 * fw.get('affinity', 1.0)
    following_bonus = (12.0 if reel.user_id in following_ids else 0.0) * fw.get('following', 1.0)

    tag_bonus = 0.0
    for tag in tags:
        tag_bonus += tag_affinity.get(tag, 0.0) * 6.0
        tag_bonus += interest_vector.get(tag, 0.0) * 10.0
    # Mood as soft interest key
    mood = (reel.mood or '').lower()
    if mood:
        tag_bonus += interest_vector.get(mood, 0.0) * 8.0
        tag_bonus += tag_affinity.get(mood, 0.0) * 4.0
    tag_bonus *= fw.get('tag_affinity', 1.0) * fw.get('interest', 1.0)

    seen_penalty = -18.0 if reel.id in seen_ids else 0.0
    # Mild diversity: slightly prefer less-viewed rising signals
    rising = math.log1p(reel.likes_count or 0) * 1.5

    return recency + engagement + creativity + affinity_score + following_bonus + tag_bonus + seen_penalty + rising


def rank_pulse_reels(qs, viewer, *, limit: int = 40):
    """Return a ranked list of Reel instances for Pulse (For You)."""
    now = timezone.now()
    pool = list(qs.order_by('-created_at')[:400])
    if not pool:
        return []

    if not viewer:
        # Anonymous: featured + engagement + freshness
        def anon_score(r):
            age_hours = max(0.5, (now - r.created_at).total_seconds() / 3600)
            return (
                (20.0 if r.is_featured else 0.0)
                + (r.likes_count or 0) * 2
                + (r.views or 0) / 30.0
                + 30.0 / (age_hours + 4.0)
            )
        pool.sort(key=anon_score, reverse=True)
        return pool[:limit]

    affinity = get_author_affinity(viewer.id)
    tag_affinity = get_tag_affinity(viewer.id)
    interest_vector = get_user_interest_vector(viewer.id)
    feature_weights = get_learned_feature_weights()

    following_ids: set[int] = set()
    try:
        from users.models import Follow
        following_ids = set(
            Follow.objects.filter(follower=viewer).values_list('following_id', flat=True)
        )
    except Exception:
        pass

    since = now - timedelta(days=7)
    seen_ids = set(
        ContentEngagementEvent.objects.filter(
            user=viewer,
            content_type='reel',
            event_type__in=('view', 'dwell_3s', 'dwell_10s'),
            created_at__gte=since,
        ).values_list('content_id', flat=True)[:800]
    )

    scored = [
        (
            score_reel(
                reel,
                affinity=affinity,
                following_ids=following_ids,
                tag_affinity=tag_affinity,
                interest_vector=interest_vector,
                feature_weights=feature_weights,
                seen_ids=seen_ids,
                now=now,
            ),
            reel,
        )
        for reel in pool
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)

    # Author diversity: avoid 3+ in a row from same creator in top slice
    diversified = []
    recent_authors: list[int] = []
    deferred = []
    for score, reel in scored:
        if recent_authors[-2:].count(reel.user_id) >= 2:
            deferred.append((score, reel))
            continue
        diversified.append(reel)
        recent_authors.append(reel.user_id)
        if len(diversified) >= limit:
            break
    if len(diversified) < limit:
        for _, reel in deferred:
            if reel not in diversified:
                diversified.append(reel)
            if len(diversified) >= limit:
                break
    return diversified
