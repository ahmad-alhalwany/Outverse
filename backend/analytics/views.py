from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from bottles.models import MessageBottle
from challenges.models import Challenge, Submission
from ideas.models import Idea
from moderation.models import FlaggedContent
from moods.models import Mood
from notifications.models import Notification
from posts.models import Comment, Post
from reels.models import Reel, ReelComment
from shop.models import ShopItem, Transaction
from stories.models import Story
from users.models import Profile, User


class PlatformAnalyticsView(APIView):
    def get(self, request):
        data = {
            'users': User.objects.count(),
            'challenges': Challenge.objects.count(),
            'ideas': Idea.objects.count(),
            'moods': Mood.objects.count(),
            'bottles': MessageBottle.objects.count(),
            'stories': Story.objects.count(),
            'shop_items': ShopItem.objects.count(),
        }
        return Response(data)


class AdminDashboardView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
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

        return Response({
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
        })
