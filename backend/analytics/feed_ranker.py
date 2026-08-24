"""Creativity-first feed ranking with affinity + light learned weights.

Not a trained neural recommender — blends heuristics with engagement-derived
tag affinity and cached feature multipliers so ranking improves with real
usage without requiring a separate ML training pipeline.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import timedelta

from django.core.cache import cache
from django.db.models import Case, CharField, Count, IntegerField, Value, When
from django.utils import timezone

from analytics.models import ContentEngagementEvent, ContentTagVector, FeedRankingSnapshot, UserInterestVector

EVENT_WEIGHTS = {
    'dwell_10s': 8.0,
    'dwell_3s': 3.0,
    'like': 5.0,
    'comment': 6.0,
    'share': 7.0,
    'save': 4.0,
    'repost': 5.0,
    'view': 1.0,
    'hide': -12.0,
}

POSITIVE_EVENTS = frozenset({
    'dwell_10s', 'dwell_3s', 'like', 'comment', 'share', 'save', 'repost',
})

AFFINITY_CACHE_TTL = 600
LEARNED_WEIGHTS_TTL = 3600
COLLAB_BOOST_TTL = 600
SNAPSHOT_SOURCE = 'engagement_7d'
SNAPSHOT_THROTTLE_SECONDS = 3600
INTEREST_VECTOR_REBUILD_THROTTLE = 300
INTEREST_VECTORS_BULK_REBUILD_THROTTLE = 3600
INTEREST_VECTOR_LOOKBACK_DAYS = 30
POOL_SIZE = 400
EVERGREEN_POOL_SIZE = 100
# ponytail: static multipliers tuned by feel, not learned like
# get_learned_feature_weights(). Upgrade path: fold into that self-tuning
# system once there's enough cold-user engagement data to learn the right
# cold-start bias empirically instead of guessing it.
COLD_CREATIVITY_MULTIPLIER = 1.4
COLD_BASE_MULTIPLIER = 0.7

DEFAULT_FEATURE_WEIGHTS = {
    'recency': 1.0,
    'base': 1.0,
    'creativity': 1.15,
    'affinity': 1.0,
    'following': 1.0,
    'interest': 1.2,
    'tag_affinity': 1.1,
    'embedding': 1.0,
    'boost': 1.0,
}


def get_author_affinity(user_id: int) -> dict[int, float]:
    cache_key = f'feed:affinity:{user_id}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    since = timezone.now() - timedelta(days=30)
    rows = (
        ContentEngagementEvent.objects.filter(user_id=user_id, created_at__gte=since)
        .values('author_id', 'event_type')
        .annotate(c=Count('id'))
    )
    affinity: dict[int, float] = defaultdict(float)
    for row in rows:
        weight = EVENT_WEIGHTS.get(row['event_type'], 0.0)
        affinity[row['author_id']] += weight * row['c']

    result = dict(affinity)
    cache.set(cache_key, result, AFFINITY_CACHE_TTL)
    return result


def invalidate_author_affinity(user_id: int) -> None:
    cache.delete(f'feed:affinity:{user_id}')
    cache.delete(f'feed:tag_affinity:{user_id}')
    cache.delete(f'feed:collab_boost:{user_id}')
    cache.delete(f'feed:interest_vector:{user_id}')


def invalidate_learned_weights() -> None:
    cache.delete('feed:learned_weights:v1')


def _normalize_tags(tags) -> set[str]:
    out = set()
    for raw in tags or []:
        name = str(raw).strip().lstrip('#').lower()
        if name:
            out.add(name)
    return out


def _tag_vector_from_tags(tags) -> dict[str, float]:
    normalized = _normalize_tags(tags)
    if not normalized:
        return {}
    weight = 1.0 / len(normalized)
    return {tag: weight for tag in normalized}


def _vector_norm(vec: dict[str, float]) -> float:
    return math.sqrt(sum(value * value for value in vec.values()))


def cosine_similarity(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(a.get(key, 0.0) * b.get(key, 0.0) for key in set(a) | set(b))
    norm_a = _vector_norm(a)
    norm_b = _vector_norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def dot_similarity(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    return sum(a.get(key, 0.0) * b.get(key, 0.0) for key in set(a) & set(b))


def build_user_interest_weights(user_id: int) -> dict[str, float]:
    """Derive tag weights from positive engagement on tagged posts."""
    since = timezone.now() - timedelta(days=INTEREST_VECTOR_LOOKBACK_DAYS)
    rows = list(
        ContentEngagementEvent.objects.filter(
            user_id=user_id,
            created_at__gte=since,
            content_type='post',
            event_type__in=POSITIVE_EVENTS,
        ).values_list('content_id', 'event_type')[:1000]
    )
    if not rows:
        return {}

    post_ids = {content_id for content_id, _ in rows}
    try:
        from posts.models import Post
        tags_by_id = {
            post.id: _normalize_tags(post.tags)
            for post in Post.objects.filter(id__in=post_ids).only('id', 'tags')
        }
    except Exception:
        return {}

    weights: dict[str, float] = defaultdict(float)
    for content_id, event_type in rows:
        event_weight = EVENT_WEIGHTS.get(event_type, 0.0)
        if not event_weight:
            continue
        for tag in tags_by_id.get(content_id, ()):
            weights[tag] += event_weight

    return dict(weights)


def build_content_tag_weights(content_type: str, content_id: int) -> dict[str, float]:
    try:
        if content_type == 'post':
            from posts.models import Post
            post = Post.objects.filter(id=content_id).only('tags').first()
            if not post:
                return {}
            return _tag_vector_from_tags(post.tags)
        if content_type == 'reel':
            from reels.models import Reel
            reel = Reel.objects.filter(id=content_id).only('caption', 'tags').first()
            if not reel:
                return {}
            tags = list(getattr(reel, 'tags', None) or [])
            caption = getattr(reel, 'caption', '') or ''
            for token in caption.split():
                if token.startswith('#') and len(token) > 1:
                    tags.append(token[1:])
            return _tag_vector_from_tags(tags)
    except Exception:
        return {}
    return {}


def rebuild_user_interest_vector(user_id: int) -> UserInterestVector:
    weights = build_user_interest_weights(user_id)
    obj, _created = UserInterestVector.objects.update_or_create(
        user_id=user_id,
        defaults={'weights': weights},
    )
    cache.delete(f'feed:interest_vector:{user_id}')
    return obj


def rebuild_content_tag_vector(content_type: str, content_id: int) -> ContentTagVector | None:
    weights = build_content_tag_weights(content_type, content_id)
    if not weights:
        ContentTagVector.objects.filter(
            content_type=content_type,
            content_id=content_id,
        ).delete()
        return None
    obj, _created = ContentTagVector.objects.update_or_create(
        content_type=content_type,
        content_id=content_id,
        defaults={'weights': weights},
    )
    return obj


def maybe_rebuild_interest_vector(user_id: int) -> None:
    """Throttled per-user rebuild after engagement ingest."""
    cache_key = f'feed:interest_rebuild:{user_id}'
    if cache.get(cache_key):
        return
    try:
        rebuild_user_interest_vector(user_id)
        cache.set(cache_key, 1, INTEREST_VECTOR_REBUILD_THROTTLE)
    except Exception:
        pass


def maybe_rebuild_stale_interest_vectors() -> None:
    """Rebuild vectors for recently active users (throttled bulk pass)."""
    cache_key = 'feed:interest_vectors_bulk_rebuild'
    if cache.get(cache_key):
        return
    try:
        since = timezone.now() - timedelta(days=7)
        user_ids = (
            ContentEngagementEvent.objects.filter(
                created_at__gte=since,
                user_id__isnull=False,
                event_type__in=POSITIVE_EVENTS,
            )
            .values_list('user_id', flat=True)
            .distinct()[:200]
        )
        for user_id in user_ids:
            rebuild_user_interest_vector(user_id)
        cache.set(cache_key, 1, INTEREST_VECTORS_BULK_REBUILD_THROTTLE)
    except Exception:
        pass


def get_user_interest_vector(user_id: int) -> dict[str, float]:
    cache_key = f'feed:interest_vector:{user_id}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        row = UserInterestVector.objects.filter(user_id=user_id).only('weights').first()
        if row and row.weights:
            cache.set(cache_key, row.weights, AFFINITY_CACHE_TTL)
            return row.weights
    except Exception:
        pass

    cache.set(cache_key, {}, AFFINITY_CACHE_TTL)
    return {}


def get_post_tag_vector(post) -> dict[str, float]:
    return _tag_vector_from_tags(getattr(post, 'tags', None))


def get_tag_affinity(user_id: int) -> dict[str, float]:
    """Per-user tag preference from engagement on tagged posts."""
    cache_key = f'feed:tag_affinity:{user_id}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    since = timezone.now() - timedelta(days=30)
    rows = list(
        ContentEngagementEvent.objects.filter(
            user_id=user_id,
            created_at__gte=since,
            content_type='post',
        ).values_list('content_id', 'event_type')[:800]
    )
    if not rows:
        cache.set(cache_key, {}, AFFINITY_CACHE_TTL)
        return {}

    post_ids = {cid for cid, _ in rows}
    try:
        from posts.models import Post
        tags_by_id = {
            p.id: _normalize_tags(p.tags)
            for p in Post.objects.filter(id__in=post_ids).only('id', 'tags')
        }
    except Exception:
        cache.set(cache_key, {}, AFFINITY_CACHE_TTL)
        return {}

    affinity: dict[str, float] = defaultdict(float)
    for content_id, event_type in rows:
        weight = EVENT_WEIGHTS.get(event_type, 0.0)
        if not weight:
            continue
        for tag in tags_by_id.get(content_id, ()):
            affinity[tag] += weight

    result = dict(affinity)
    cache.set(cache_key, result, AFFINITY_CACHE_TTL)
    return result


def maybe_persist_feed_weights_snapshot(weights: dict[str, float]) -> None:
    """Persist weights at most once per hour for auditing."""
    try:
        last = FeedRankingSnapshot.objects.order_by('-created_at').first()
        if last and (timezone.now() - last.created_at).total_seconds() < SNAPSHOT_THROTTLE_SECONDS:
            return
        FeedRankingSnapshot.objects.create(weights=weights, source=SNAPSHOT_SOURCE)
    except Exception:
        pass


def persist_feed_weights_snapshot(
    weights: dict[str, float] | None = None,
    source: str = SNAPSHOT_SOURCE,
) -> FeedRankingSnapshot:
    """Force a snapshot save (management command / admin)."""
    if weights is None:
        weights = get_learned_feature_weights()
    return FeedRankingSnapshot.objects.create(weights=weights, source=source)


def get_collaborative_author_boost(user_id: int) -> dict[int, float]:
    """Co-engagement boost: authors liked by users who share content taste."""
    cache_key = f'feed:collab_boost:{user_id}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    since = timezone.now() - timedelta(days=30)
    viewer_content_ids = list(
        ContentEngagementEvent.objects.filter(
            user_id=user_id,
            created_at__gte=since,
            event_type__in=POSITIVE_EVENTS,
        )
        .values_list('content_id', flat=True)
        .distinct()[:200]
    )
    if not viewer_content_ids:
        cache.set(cache_key, {}, COLLAB_BOOST_TTL)
        return {}

    neighbor_overlap: dict[int, int] = defaultdict(int)
    neighbor_rows = (
        ContentEngagementEvent.objects.filter(
            created_at__gte=since,
            event_type__in=POSITIVE_EVENTS,
            content_id__in=viewer_content_ids,
        )
        .exclude(user_id=user_id)
        .values('user_id', 'content_id')
        .distinct()[:800]
    )
    for row in neighbor_rows:
        neighbor_overlap[row['user_id']] += 1

    if not neighbor_overlap:
        cache.set(cache_key, {}, COLLAB_BOOST_TTL)
        return {}

    top_neighbors = sorted(neighbor_overlap.items(), key=lambda item: -item[1])[:50]
    neighbor_ids = [uid for uid, _ in top_neighbors]
    overlap_map = dict(top_neighbors)
    content_count = max(1, len(viewer_content_ids))

    boost: dict[int, float] = defaultdict(float)
    neighbor_events = (
        ContentEngagementEvent.objects.filter(
            user_id__in=neighbor_ids,
            created_at__gte=since,
            event_type__in=POSITIVE_EVENTS,
        )
        .values('user_id', 'author_id', 'event_type')
        .annotate(c=Count('id'))
    )
    for row in neighbor_events:
        weight = EVENT_WEIGHTS.get(row['event_type'], 0.0)
        if not weight:
            continue
        overlap = overlap_map.get(row['user_id'], 1)
        boost[row['author_id']] += weight * row['c'] * (overlap / content_count)

    result = dict(boost)
    cache.set(cache_key, result, COLLAB_BOOST_TTL)
    return result


def get_learned_feature_weights() -> dict[str, float]:
    """Cached feature multipliers from recent positive vs hide rates.

    Bumps creativity / interest when those post shapes earn relatively more
    positive engagement; dampens when hides dominate.
    """
    cache_key = 'feed:learned_weights:v1'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    weights = dict(DEFAULT_FEATURE_WEIGHTS)
    since = timezone.now() - timedelta(days=7)
    try:
        rows = (
            ContentEngagementEvent.objects.filter(
                created_at__gte=since,
                content_type='post',
            )
            .values('event_type')
            .annotate(c=Count('id'))
        )
        counts = {row['event_type']: row['c'] for row in rows}
        positive = sum(counts.get(et, 0) for et in POSITIVE_EVENTS)
        hides = counts.get('hide', 0)
        total = max(1, positive + hides)

        # More hides → pull back aggressive boosts; more saves/shares → lean creative.
        hide_ratio = hides / total
        save_share = (counts.get('save', 0) + counts.get('share', 0)) / total
        dwell = (counts.get('dwell_10s', 0) + counts.get('dwell_3s', 0)) / total

        weights['creativity'] = max(0.85, min(1.45, 1.15 + save_share * 0.8 - hide_ratio * 0.5))
        weights['interest'] = max(0.9, min(1.5, 1.2 + dwell * 0.4 - hide_ratio * 0.3))
        weights['tag_affinity'] = max(0.9, min(1.4, 1.1 + dwell * 0.35))
        weights['affinity'] = max(0.85, min(1.35, 1.0 + (counts.get('like', 0) / total) * 0.5))
        weights['recency'] = max(0.85, min(1.25, 1.0 + dwell * 0.2 - hide_ratio * 0.25))
    except Exception:
        pass

    cache.set(cache_key, weights, LEARNED_WEIGHTS_TTL)
    maybe_persist_feed_weights_snapshot(weights)
    maybe_rebuild_stale_interest_vectors()
    return weights


def score_post(
    post,
    *,
    affinity: dict[int, float],
    following_ids: set[int],
    interests: list,
    now,
    tag_affinity: dict[str, float] | None = None,
    interest_vector: dict[str, float] | None = None,
    feature_weights: dict[str, float] | None = None,
    collaborative_boost: dict[int, float] | None = None,
) -> tuple[float, str]:
    fw = feature_weights or DEFAULT_FEATURE_WEIGHTS
    tag_affinity = tag_affinity or {}
    interest_vector = interest_vector or {}

    age_hours = max(0.5, (now - post.created_at).total_seconds() / 3600)
    recency = (48.0 / (age_hours + 6.0)) * fw.get('recency', 1.0)

    base = (
        (post.likes_count or 0) * 2.0
        + (post.comments_count or 0) * 3.0
        + (post.shares_count or 0) * 4.0
        + (post.reposts_count or 0) * 3.0
        + (post.views or 0) / 20.0
    ) * fw.get('base', 1.0)

    creativity = 0.0
    if getattr(post, 'post_type', 'normal') in ('poll', 'question'):
        creativity += 6.0
    if getattr(post, 'inspiration_question_id', None):
        creativity += 8.0
    if getattr(post, 'mood', None):
        creativity += 2.0
    post_tags = _normalize_tags(getattr(post, 'tags', None))
    if len(post_tags) >= 2:
        creativity += 3.0
    creativity *= fw.get('creativity', 1.0)

    affinity_score = affinity.get(post.user_id, 0.0) * 0.15 * fw.get('affinity', 1.0)
    following_bonus = (10.0 if post.user_id in following_ids else 0.0) * fw.get('following', 1.0)

    interest_bonus = 0.0
    for raw in interests[:12]:
        if not isinstance(raw, str):
            continue
        tag = raw.strip().lstrip('#').lower()
        if tag and tag in post_tags:
            interest_bonus += 8.0
    interest_bonus *= fw.get('interest', 1.0)

    tag_bonus = 0.0
    for tag in post_tags:
        tag_bonus += min(12.0, tag_affinity.get(tag, 0.0) * 0.08)
    tag_bonus *= fw.get('tag_affinity', 1.0)

    embedding_bonus = 0.0
    if interest_vector:
        post_vector = get_post_tag_vector(post)
        similarity = cosine_similarity(interest_vector, post_vector)
        embedding_bonus = similarity * 18.0 * fw.get('embedding', 1.0)

    collab_bonus = 0.0
    if collaborative_boost:
        collab_bonus = collaborative_boost.get(post.user_id, 0.0) * 0.1

    score = (
        base
        + creativity
        + affinity_score
        + following_bonus
        + interest_bonus
        + tag_bonus
        + embedding_bonus
        + collab_bonus
    ) * recency

    if getattr(post, 'is_boosted', False):
        expires_at = getattr(post, 'boost_expires_at', None)
        if expires_at and expires_at > now:
            score += 40.0 * fw.get('boost', 1.0)

    # Surface *why* a post was ranked here — whichever personalization signal
    # contributed most. Falls back to raw popularity, then plain freshness.
    reason_candidates = {
        'following': following_bonus,
        'interest': interest_bonus + embedding_bonus,
        'tag_affinity': tag_bonus,
        'collab': collab_bonus,
        'creativity': creativity,
    }
    top_reason, top_value = max(reason_candidates.items(), key=lambda kv: kv[1])
    reason = top_reason if top_value > 0 else ('popular' if base > 0 else 'new')

    return score, reason


def _apply_diversity(
    scored: list[tuple[float, int, int]],
    tag_by_id: dict[int, str] | None = None,
    max_per_author: int = 2,
    max_per_tag: int = 3,
    window: int = 15,
) -> list[int]:
    """Limit author *and* topic concentration in the top of the feed.

    Author-only capping still let a same-topic run through from different
    authors (e.g. 5 #digitalart posts in a row) — cap each post's primary tag
    the same way, within the same lead window.
    """
    tag_by_id = tag_by_id or {}
    ordered: list[int] = []
    deferred: list[tuple[float, int, int]] = []
    author_hits: dict[int, int] = defaultdict(int)
    tag_hits: dict[str, int] = defaultdict(int)

    for item in scored:
        score, post_id, author_id = item
        tag = tag_by_id.get(post_id, '')
        if len(ordered) < window and (
            author_hits[author_id] >= max_per_author
            or (tag and tag_hits[tag] >= max_per_tag)
        ):
            deferred.append(item)
            continue
        ordered.append(post_id)
        author_hits[author_id] += 1
        if tag:
            tag_hits[tag] += 1

    seen = set(ordered)
    for _score, post_id, _author_id in deferred + scored:
        if post_id not in seen:
            ordered.append(post_id)
            seen.add(post_id)
    return ordered


def rank_for_you_queryset(qs, viewer, following_ids=None):
    """Return queryset ordered by creativity-first score for the viewer."""
    following_ids = following_ids or []
    following_set = set(following_ids)

    recent_pool = list(qs.order_by('-created_at')[:POOL_SIZE])
    recent_ids = {post.id for post in recent_pool}
    # ponytail: recency-only candidates can never resurface a strong older post
    # no matter how well it matches the viewer — widen with a small evergreen
    # slice ranked by raw engagement instead of date. Global ranking, not
    # per-user; upgrade path: rank the evergreen slice by tag/interest match
    # too if this still under-serves niche old content.
    evergreen_pool = list(
        qs.exclude(id__in=recent_ids)
        .order_by('-likes_count', '-comments_count', '-shares_count')[:EVERGREEN_POOL_SIZE]
    )
    pool = recent_pool + evergreen_pool
    if not pool:
        return qs.order_by('-created_at')

    affinity = get_author_affinity(viewer.id)
    tag_affinity = get_tag_affinity(viewer.id)
    interest_vector = get_user_interest_vector(viewer.id)
    feature_weights = get_learned_feature_weights()
    collaborative_boost = get_collaborative_author_boost(viewer.id)
    interests = list(getattr(viewer, 'interests', None) or [])
    now = timezone.now()

    # Cold start: no engagement history and no stated interests means every
    # personalization signal below is empty, so the feed would otherwise just
    # be raw popularity. Lean on creativity (content-based, needs no history)
    # instead of popularity for that first impression.
    if not affinity and not tag_affinity and not interest_vector and not interests:
        feature_weights = dict(feature_weights)
        feature_weights['creativity'] = feature_weights.get('creativity', 1.0) * COLD_CREATIVITY_MULTIPLIER
        feature_weights['base'] = feature_weights.get('base', 1.0) * COLD_BASE_MULTIPLIER

    # Suppress authors the viewer recently hid
    hidden_authors = set()
    try:
        since = now - timedelta(days=30)
        hidden_authors = set(
            ContentEngagementEvent.objects.filter(
                user_id=viewer.id,
                event_type='hide',
                created_at__gte=since,
            ).values_list('author_id', flat=True).distinct()[:200]
        )
    except Exception:
        hidden_authors = set()

    id_order = {post.id: idx for idx, post in enumerate(pool)}
    scored = []
    reason_by_id: dict[int, str] = {}
    tag_by_id: dict[int, str] = {}
    for post in pool:
        if post.user_id in hidden_authors:
            continue
        post_score, reason = score_post(
            post,
            affinity=affinity,
            following_ids=following_set,
            interests=interests,
            now=now,
            tag_affinity=tag_affinity,
            interest_vector=interest_vector,
            feature_weights=feature_weights,
            collaborative_boost=collaborative_boost,
        )
        reason_by_id[post.id] = reason
        post_tags = _normalize_tags(getattr(post, 'tags', None))
        tag_by_id[post.id] = min(post_tags) if post_tags else ''
        scored.append((post_score, post.id, post.user_id))
    scored.sort(key=lambda row: (-row[0], id_order[row[1]]))
    ordered_ids = _apply_diversity(scored, tag_by_id)

    whens = [When(id=post_id, then=rank) for rank, post_id in enumerate(ordered_ids)]
    reason_whens = [
        When(id=post_id, then=Value(reason_by_id.get(post_id, ''))) for post_id in ordered_ids
    ]
    return qs.filter(id__in=ordered_ids).annotate(
        _feed_rank=Case(*whens, default=999999, output_field=IntegerField()),
        _feed_reason=Case(*reason_whens, default=Value(''), output_field=CharField()),
    ).order_by('_feed_rank')
