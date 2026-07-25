"""Trending tag computation with recency-weighted engagement."""

from __future__ import annotations

from collections import Counter
from datetime import timedelta

from django.utils import timezone

from analytics.models import ContentEngagementEvent
from posts.models import Post
from reels.models import Reel

EVENT_BOOST = {
    'share': 3.0,
    'like': 2.0,
    'comment': 2.5,
    'save': 1.5,
    'repost': 2.0,
    'dwell_10s': 1.2,
    'dwell_3s': 0.6,
}


def compute_trending_tags(limit: int = 12) -> list[dict]:
    since = timezone.now() - timedelta(hours=48)
    scores: Counter[str] = Counter()
    counts: Counter[str] = Counter()

    for post in Post.objects.filter(created_at__gte=since).only(
        'tags', 'likes_count', 'comments_count', 'shares_count', 'created_at',
    ):
        weight = 1.0 + (post.likes_count or 0) * 0.08 + (post.comments_count or 0) * 0.12 + (post.shares_count or 0) * 0.15
        for tag in post.tags or []:
            name = str(tag).strip().lstrip('#')
            if not name:
                continue
            key = name.lower()
            scores[key] += weight
            counts[key] += 1

    for reel in Reel.objects.filter(created_at__gte=since, is_active=True).only(
        'tags', 'likes_count', 'created_at',
    ):
        weight = 1.0 + (reel.likes_count or 0) * 0.1
        for tag in (reel.tags or '').split(','):
            name = tag.strip().lstrip('#')
            if not name:
                continue
            key = name.lower()
            scores[key] += weight * 0.8
            counts[key] += 1

    since_events = timezone.now() - timedelta(hours=24)
    post_ids = set(
        ContentEngagementEvent.objects.filter(
            content_type='post',
            created_at__gte=since_events,
            event_type__in=EVENT_BOOST,
        ).values_list('content_id', flat=True)[:500]
    )
    if post_ids:
        tag_map: dict[int, list[str]] = {}
        for post in Post.objects.filter(id__in=post_ids).only('id', 'tags'):
            tag_map[post.id] = [
                str(t).strip().lstrip('#').lower()
                for t in (post.tags or [])
                if str(t).strip()
            ]
        for ev in ContentEngagementEvent.objects.filter(
            content_type='post',
            content_id__in=post_ids,
            created_at__gte=since_events,
            event_type__in=EVENT_BOOST,
        ).values('content_id', 'event_type'):
            boost = EVENT_BOOST.get(ev['event_type'], 0.0)
            for tag in tag_map.get(ev['content_id'], []):
                scores[tag] += boost

    payload = []
    for tag, score in scores.most_common(limit):
        payload.append({
            'tag': tag,
            'count': counts[tag],
            'score': round(score, 1),
        })
    return payload
