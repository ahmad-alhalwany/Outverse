"""Aggregated creator-facing analytics across posts, reels, shares, and reactions."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from posts.models import Post, PostShareLog, Reaction
from ideas.models import Idea, IdeaPledge
from questions.feedback import (
    category_stats_for_user,
    preferred_categories_for_user,
    skipped_stats_for_user,
)
from reels.models import Reel, ReelLike, ReelShareLog


def _merge_counts(*dicts: dict[str, int]) -> dict[str, int]:
    merged: dict[str, int] = {}
    for d in dicts:
        for key, value in d.items():
            merged[key] = merged.get(key, 0) + value
    return dict(sorted(merged.items(), key=lambda x: -x[1]))


def _daily_series(queryset, date_field: str, since, days: int = 7):
    rows = (
        queryset.filter(**{f'{date_field}__gte': since})
        .annotate(day=TruncDate(date_field))
        .values('day')
        .annotate(c=Count('id'))
        .order_by('day')
    )
    by_day = {str(r['day']): r['c'] for r in rows}
    now = timezone.now()
    series = []
    for i in range(days - 1, -1, -1):
        day = (now - timedelta(days=i)).date()
        key = str(day)
        series.append({
            'date': key,
            'day': day.strftime('%a'),
            'count': by_day.get(key, 0),
        })
    return series


def build_creator_analytics(user) -> dict:
    now = timezone.now()
    week_ago = now - timedelta(days=7)

    posts_qs = Post.objects.filter(user=user).exclude(
        repost_of__isnull=False, text='',
    )
    reels_qs = Reel.objects.filter(user=user, is_active=True)
    ideas_qs = Idea.objects.filter(owner=user).annotate(
        support_count=Count('votes', distinct=True),
        comment_count=Count('idea_comments', distinct=True),
    )
    ideas_list = list(ideas_qs)

    post_totals = posts_qs.aggregate(
        total_views=Sum('views'),
        total_likes=Sum('likes_count'),
        total_comments=Sum('comments_count'),
        total_shares=Sum('shares_count'),
        total_reposts=Sum('reposts_count'),
    )
    reel_totals = reels_qs.aggregate(
        total_views=Sum('views'),
        total_likes=Sum('likes_count'),
        total_comments=Sum('comments_count'),
        total_shares=Sum('shares_count'),
    )

    post_ids = list(posts_qs.values_list('id', flat=True))
    reel_ids = list(reels_qs.values_list('id', flat=True))

    post_shares = dict(
        PostShareLog.objects.filter(post_id__in=post_ids)
        .values('channel')
        .annotate(c=Count('id'))
        .values_list('channel', 'c')
    ) if post_ids else {}
    reel_shares = dict(
        ReelShareLog.objects.filter(reel_id__in=reel_ids)
        .values('channel')
        .annotate(c=Count('id'))
        .values_list('channel', 'c')
    ) if reel_ids else {}

    post_reactions = dict(
        Reaction.objects.filter(post_id__in=post_ids)
        .values('type')
        .annotate(c=Count('id'))
        .values_list('type', 'c')
    ) if post_ids else {}
    reel_reactions = dict(
        ReelLike.objects.filter(reel_id__in=reel_ids)
        .values('type')
        .annotate(c=Count('id'))
        .values_list('type', 'c')
    ) if reel_ids else {}

    inspired = posts_qs.filter(inspiration_question__isnull=False)
    inspiration_by_category = {
        row['inspiration_question__category']: row['c']
        for row in inspired.values('inspiration_question__category')
        .annotate(c=Count('id'))
        .order_by('-c')
        if row['inspiration_question__category']
    }

    share_trend = _merge_counts(
        {str(r['day']): r['c'] for r in (
            PostShareLog.objects.filter(post_id__in=post_ids, created_at__gte=week_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(c=Count('id'))
        )} if post_ids else {},
        {str(r['day']): r['c'] for r in (
            ReelShareLog.objects.filter(reel_id__in=reel_ids, created_at__gte=week_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(c=Count('id'))
        )} if reel_ids else {},
    )

    reaction_trend = _merge_counts(
        {str(r['day']): r['c'] for r in (
            Reaction.objects.filter(post_id__in=post_ids, created_at__gte=week_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(c=Count('id'))
        )} if post_ids else {},
        {str(r['day']): r['c'] for r in (
            ReelLike.objects.filter(reel_id__in=reel_ids, created_at__gte=week_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(c=Count('id'))
        )} if reel_ids else {},
    )

    engagement_trend = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date()
        key = str(day)
        engagement_trend.append({
            'date': key,
            'day': day.strftime('%a'),
            'shares': share_trend.get(key, 0),
            'reactions': reaction_trend.get(key, 0),
        })

    top_content = []
    for post in posts_qs.order_by('-views')[:8]:
        score = (
            (post.views or 0)
            + (post.likes_count or 0) * 2
            + (post.shares_count or 0) * 3
            + (post.reposts_count or 0) * 4
        )
        top_content.append({
            'type': 'post',
            'id': post.id,
            'title': (post.text or 'Post')[:80],
            'views': post.views or 0,
            'likes': post.likes_count or 0,
            'shares': post.shares_count or 0,
            'reposts': post.reposts_count or 0,
            'score': score,
        })
    for reel in reels_qs.order_by('-views')[:8]:
        score = (
            (reel.views or 0)
            + (reel.likes_count or 0) * 2
            + (reel.shares_count or 0) * 3
        )
        top_content.append({
            'type': 'reel',
            'id': reel.id,
            'title': (reel.caption or 'Signal')[:80],
            'views': reel.views or 0,
            'likes': reel.likes_count or 0,
            'shares': reel.shares_count or 0,
            'reposts': 0,
            'score': score,
        })
    top_content.sort(key=lambda x: x['score'], reverse=True)
    top_content = top_content[:8]

    for idea in sorted(ideas_list, key=lambda i: i.support_count, reverse=True)[:8]:
        score = (
            (idea.support_count or 0) * 3
            + (idea.funding_raised or 0) // 5
            + (idea.comment_count or 0) * 2
        )
        top_content.append({
            'type': 'idea',
            'id': idea.id,
            'title': (idea.title or 'Idea')[:80],
            'views': 0,
            'likes': idea.support_count or 0,
            'shares': 0,
            'reposts': 0,
            'score': score,
        })
    top_content.sort(key=lambda x: x['score'], reverse=True)
    top_content = top_content[:8]

    idea_funding = sum(i.funding_raised or 0 for i in ideas_list)
    idea_supporters = sum(i.support_count or 0 for i in ideas_list)
    pledge_count = IdeaPledge.objects.filter(idea__owner=user).count()
    ideas_by_category = {
        row['category']: row['c']
        for row in ideas_qs.values('category').annotate(c=Count('id')).order_by('-c')
        if row['category']
    }

    total_views = (post_totals['total_views'] or 0) + (reel_totals['total_views'] or 0)
    total_likes = (post_totals['total_likes'] or 0) + (reel_totals['total_likes'] or 0)
    total_comments = (
        (post_totals['total_comments'] or 0) + (reel_totals['total_comments'] or 0)
    )
    total_shares = (post_totals['total_shares'] or 0) + (reel_totals['total_shares'] or 0)
    total_reposts = post_totals['total_reposts'] or 0
    total_reactions = sum(post_reactions.values()) + sum(reel_reactions.values())

    return {
        'summary': {
            'total_content': posts_qs.count() + reels_qs.count() + len(ideas_list),
            'total_posts': posts_qs.count(),
            'total_signals': reels_qs.count(),
            'total_ideas': len(ideas_list),
            'total_views': total_views,
            'total_likes': total_likes,
            'total_comments': total_comments,
            'total_shares': total_shares,
            'total_reposts': total_reposts,
            'total_reactions': total_reactions,
            'idea_supporters': idea_supporters,
            'idea_funding_raised': idea_funding,
        },
        'posts': {
            'total_posts': posts_qs.count(),
            'total_views': post_totals['total_views'] or 0,
            'total_likes': post_totals['total_likes'] or 0,
            'total_comments': post_totals['total_comments'] or 0,
            'total_shares': post_totals['total_shares'] or 0,
            'total_reposts': total_reposts,
        },
        'reels': {
            'total_signals': reels_qs.count(),
            'total_views': reel_totals['total_views'] or 0,
            'total_likes': reel_totals['total_likes'] or 0,
            'total_comments': reel_totals['total_comments'] or 0,
            'total_shares': reel_totals['total_shares'] or 0,
        },
        'ideas': {
            'total_ideas': len(ideas_list),
            'total_supporters': idea_supporters,
            'total_funding_raised': idea_funding,
            'total_pledges': pledge_count,
            'by_category': ideas_by_category,
        },
        'shares_by_channel': _merge_counts(post_shares, reel_shares),
        'reactions_by_type': _merge_counts(post_reactions, reel_reactions),
        'inspiration': {
            'published': inspired.count(),
            'by_category': inspiration_by_category,
            'answered_by_category': category_stats_for_user(user),
            'skipped_by_category': skipped_stats_for_user(user),
            'preferred_categories': preferred_categories_for_user(user),
        },
        'engagement_trend': engagement_trend,
        'top_content': top_content,
    }
