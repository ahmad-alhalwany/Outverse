from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from bottles.models import MessageBottle
from challenges.models import Challenge, Submission
from ideas.models import Idea
from moderation.models import FlaggedContent
from moods.models import Mood
from narratives.models import Story as ForgeStory
from notifications.models import Notification
from posts.models import Comment, Post
from reels.models import Reel, ReelComment
from shop.models import ShopItem, Transaction
from stories.models import Story
from users.models import Profile, User

from .creator import build_creator_analytics
from .feed_ranker import invalidate_author_affinity, invalidate_learned_weights, maybe_rebuild_interest_vector
from .models import ContentEngagementEvent


class EngagementEventsView(APIView):
    """Batch ingest engagement signals for feed ranking."""

    permission_classes = [IsAuthenticated]

    VALID_TYPES = {c for c, _ in ContentEngagementEvent.EVENT_TYPES}
    VALID_CONTENT = {'post', 'reel', 'story'}

    def post(self, request):
        events = request.data.get('events')
        if not isinstance(events, list) or not events:
            return Response({'error': 'events array required.'}, status=400)
        rows = []
        for raw in events[:50]:
            if not isinstance(raw, dict):
                continue
            content_type = (raw.get('content_type') or '').lower()
            event_type = (raw.get('event_type') or '').lower()
            content_id = raw.get('content_id')
            author_id = raw.get('author_id')
            if content_type not in self.VALID_CONTENT:
                continue
            if event_type not in self.VALID_TYPES:
                continue
            try:
                content_id = int(content_id)
                author_id = int(author_id)
            except (TypeError, ValueError):
                continue
            # Collapse rapid view spam (5 min window)
            if event_type == 'view':
                throttle_key = (
                    f'eng:view:{request.user.id}:{content_type}:{content_id}'
                )
                if cache.get(throttle_key):
                    continue
                cache.set(throttle_key, 1, timeout=300)
            rows.append(ContentEngagementEvent(
                user=request.user,
                content_type=content_type,
                content_id=content_id,
                author_id=author_id,
                event_type=event_type,
                metadata=raw.get('metadata') if isinstance(raw.get('metadata'), dict) else {},
            ))
        if rows:
            ContentEngagementEvent.objects.bulk_create(rows)
            invalidate_author_affinity(request.user.id)
            invalidate_learned_weights()
            maybe_rebuild_interest_vector(request.user.id)
        return Response({'accepted': len(rows)})


class CreatorAnalyticsView(APIView):
    """Unified creator dashboard: posts, reels, shares, reactions, inspiration."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(build_creator_analytics(request.user))


class PlatformAnalyticsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        data = cache.get('analytics:platform')
        if data is None:
            data = {
                'users': User.objects.count(),
                'challenges': Challenge.objects.count(),
                'ideas': Idea.objects.count(),
                'moods': Mood.objects.count(),
                'bottles': MessageBottle.objects.count(),
                'stories': Story.objects.count(),
                'shop_items': ShopItem.objects.count(),
            }
            cache.set('analytics:platform', data, 300)
        return Response(data)


class AdminDashboardView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        cached = cache.get('analytics:admin_dashboard')
        if cached is not None:
            return Response(cached)
        now = timezone.now()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=28)

        pending_flags = FlaggedContent.objects.filter(status='pending').count()
        active_users = Profile.objects.filter(status='active').count()
        suspended_users = Profile.objects.exclude(status='active').count()

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        orders_today = Transaction.objects.filter(
            timestamp__gte=today_start, status='completed'
        ).count()
        revenue_today = sum(
            Transaction.objects.filter(
                timestamp__gte=today_start, status='completed'
            ).values_list('amount', flat=True)
        )

        def daily_counts(model, date_field='created_at', since=week_ago):
            rows = (
                model.objects.filter(**{f'{date_field}__gte': since})
                .annotate(day=TruncDate(date_field))
                .values('day')
                .annotate(c=Count('id'))
                .order_by('day')
            )
            return {str(r['day']): r['c'] for r in rows}

        posts_by_day = daily_counts(Post)
        reels_by_day = daily_counts(Reel)
        comments_by_day = daily_counts(Comment)

        weekly_activity = []
        for i in range(6, -1, -1):
            day = (now - timedelta(days=i)).date()
            key = str(day)
            weekly_activity.append({
                'day': day.strftime('%a'),
                'date': key,
                'posts': posts_by_day.get(key, 0),
                'reels': reels_by_day.get(key, 0),
                'comments': comments_by_day.get(key, 0),
                'total': (
                    posts_by_day.get(key, 0)
                    + reels_by_day.get(key, 0)
                    + comments_by_day.get(key, 0)
                ),
            })

        mood_rows = (
            Mood.objects.filter(created_at__gte=month_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day', 'type')
            .annotate(c=Count('id'))
        )
        mood_heatmap = {}
        for row in mood_rows:
            key = str(row['day'])
            if key not in mood_heatmap:
                mood_heatmap[key] = {'happy': 0, 'sad': 0, 'creative': 0}
            mood_heatmap[key][row['type']] = row['c']

        mood_calendar = []
        for i in range(27, -1, -1):
            day = (now - timedelta(days=i)).date()
            key = str(day)
            moods = mood_heatmap.get(key, {'happy': 0, 'sad': 0, 'creative': 0})
            dominant = max(moods, key=moods.get)
            mood_calendar.append({
                'day': day.day,
                'date': key,
                'moods': moods,
                'dominant': dominant,
                'total': sum(moods.values()),
            })

        creativity_weeks = []
        for w in range(5, -1, -1):
            start = now - timedelta(days=(w + 1) * 7)
            end = now - timedelta(days=w * 7)
            score = (
                Submission.objects.filter(
                    submitted_at__gte=start, submitted_at__lt=end
                ).count()
                * 3
                + Idea.objects.filter(
                    created_at__gte=start, created_at__lt=end
                ).count()
                * 2
                + Post.objects.filter(
                    created_at__gte=start, created_at__lt=end
                ).count()
            )
            creativity_weeks.append({
                'week': f'W{6 - w}',
                'score': min(100, score * 2),
            })

        total_challenges = Challenge.objects.count() or 1
        total_submissions = Submission.objects.count()
        completion_rate = min(
            100,
            round((total_submissions / (total_challenges * max(User.objects.count(), 1))) * 100),
        )

        top_supporters = list(
            Profile.objects.select_related('user')
            .order_by('-points')[:5]
            .values(
                'id', 'points', 'user__username', 'user__first_name', 'user__last_name'
            )
        )

        achievement_total = 0
        achievement_unlocked = 0
        for achievements in Profile.objects.values_list('achievements', flat=True):
            if isinstance(achievements, list):
                achievement_total += len(achievements)
                achievement_unlocked += sum(
                    1 for a in achievements
                    if isinstance(a, dict) and a.get('completed')
                )

        recent_flags = list(
            FlaggedContent.objects.order_by('-created_at')[:8].values(
                'id', 'type', 'content', 'reporter', 'status', 'created_at'
            )
        )

        payload = {
            'counts': {
                'users': User.objects.count(),
                'active_users': active_users,
                'suspended_users': suspended_users,
                'posts': Post.objects.count(),
                'reels': Reel.objects.filter(is_active=True).count(),
                'comments': Comment.objects.count() + ReelComment.objects.count(),
                'challenges': Challenge.objects.count(),
                'ideas': Idea.objects.count(),
                'bottles': MessageBottle.objects.count(),
                'stories': Story.objects.count(),
                'shop_items': ShopItem.objects.filter(is_available=True).count(),
                'notifications': Notification.objects.count(),
                'pending_flags': pending_flags,
            },
            'shop': {
                'orders_today': orders_today,
                'revenue_today': revenue_today,
                'total_orders': Transaction.objects.filter(status='completed').count(),
                'active_products': ShopItem.objects.filter(is_available=True).count(),
                'featured_products': ShopItem.objects.filter(is_featured=True).count(),
            },
            'weekly_activity': weekly_activity,
            'mood_calendar': mood_calendar,
            'creativity_weeks': creativity_weeks,
            'completion_rate': completion_rate,
            'bottles_caught': MessageBottle.objects.filter(
                caught_by__isnull=False
            ).count(),
            'social_score': min(10, round(Notification.objects.count() / max(User.objects.count(), 1), 1)),
            'top_supporters': top_supporters,
            'achievements': {
                'total_slots': achievement_total,
                'unlocked': achievement_unlocked,
                'remaining': max(0, achievement_total - achievement_unlocked),
            },
            'recent_flags': recent_flags,
            'flags_by_type': dict(
                FlaggedContent.objects.filter(status='pending')
                .values('type')
                .annotate(c=Count('id'))
                .values_list('type', 'c')
            ),
        }
        cache.set('analytics:admin_dashboard', payload, 300)
        return Response(payload)


class PersonalAnalyticsView(APIView):
    """A user's own creativity stats — the non-admin counterpart to AdminDashboardView."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=28)

        def daily_counts(queryset, date_field='created_at', since=week_ago):
            rows = (
                queryset.filter(**{f'{date_field}__gte': since})
                .annotate(day=TruncDate(date_field))
                .values('day')
                .annotate(c=Count('id'))
                .order_by('day')
            )
            return {str(r['day']): r['c'] for r in rows}

        posts_by_day = daily_counts(Post.objects.filter(user_id=user.id))
        submissions_by_day = daily_counts(
            Submission.objects.filter(user_id=user.id), date_field='submitted_at'
        )
        comments_by_day = daily_counts(Comment.objects.filter(user_id=user.id))

        weekly_activity = []
        for i in range(6, -1, -1):
            day = (now - timedelta(days=i)).date()
            key = str(day)
            posts = posts_by_day.get(key, 0)
            submissions = submissions_by_day.get(key, 0)
            comments = comments_by_day.get(key, 0)
            weekly_activity.append({
                'day': day.strftime('%a'),
                'date': key,
                'total': posts + submissions + comments,
            })

        mood_rows = (
            Mood.objects.filter(user_id=user.id, created_at__gte=month_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day', 'type')
            .annotate(c=Count('id'))
        )
        mood_by_day = {}
        for row in mood_rows:
            key = str(row['day'])
            mood_by_day.setdefault(key, {'happy': 0, 'sad': 0, 'creative': 0})
            mood_by_day[key][row['type']] = row['c']

        mood_calendar = []
        for i in range(27, -1, -1):
            day = (now - timedelta(days=i)).date()
            key = str(day)
            moods = mood_by_day.get(key, {'happy': 0, 'sad': 0, 'creative': 0})
            dominant = max(moods, key=moods.get) if any(moods.values()) else None
            mood_calendar.append({'day': day.day, 'date': key, 'dominant': dominant})

        total_challenges = Challenge.objects.count() or 1
        user_submissions = Submission.objects.filter(user_id=user.id).count()
        completion_rate = min(100, round((user_submissions / total_challenges) * 100))

        bottles_caught = MessageBottle.objects.filter(caught_by_id=user.id).count()

        owned_stories = ForgeStory.objects.filter(owner_id=user.id)
        story_genre_breakdown = dict(
            owned_stories.values('genre').annotate(c=Count('id')).values_list('genre', 'c')
        )

        # Creativity score: a lightweight blend of this week's output vs the platform average,
        # mirroring the "% above average" framing used across the admin dashboard.
        my_week_total = sum(row['total'] for row in weekly_activity)
        active_user_count = max(User.objects.filter(profile__status='active').count(), 1)
        platform_week_total = (
            Post.objects.filter(created_at__gte=week_ago).count()
            + Submission.objects.filter(submitted_at__gte=week_ago).count()
            + Comment.objects.filter(created_at__gte=week_ago).count()
        )
        platform_avg = platform_week_total / active_user_count
        above_average_pct = (
            round(((my_week_total - platform_avg) / platform_avg) * 100)
            if platform_avg > 0 else 0
        )

        creativity_score = min(100, my_week_total * 5 + completion_rate // 2)

        payload = {
            'creativity_score': creativity_score,
            'completion_rate': completion_rate,
            'bottles_caught': bottles_caught,
            'stories_count': owned_stories.count(),
            'weekly_activity': weekly_activity,
            'mood_calendar': mood_calendar,
            'above_average_pct': above_average_pct,
            'story_genre_breakdown': story_genre_breakdown,
        }
        return Response(payload)
