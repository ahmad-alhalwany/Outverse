from datetime import timedelta

from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import (
    Case, Count, ExpressionWrapper, F, FloatField, IntegerField, Max, Prefetch, Q, Sum, When,
)
from django.db.models.functions import Abs, Coalesce, Extract, Now
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from outverse.auth_utils import require_user, user_from_request
from users.models import Follow
from users.privacy import can_comment, text_has_hidden_word
from users.social import feed_hidden_author_ids, is_blocked_between, restricted_user_ids
from notifications.utils import create_notification
from bottles.models import MessageBottle
from challenges.models import Challenge
from ideas.models import Idea
from narratives.models import Story
from reels.models import Reel
from shop.models import ShopItem

from django.utils import timezone

from .models import (
    Comment, CommentReaction, CommentTranslation, CommentVote, FeedFeedback,
    OrbitList, OrbitListFollower, OrbitListMember, PollOption, PollVote,
    Post, PostDraft, PostEditHistory, PostMedia, PostVote, QuestionAnswer, Reaction,
    SavedCollection, SavedPost, ScheduledMedia, ScheduledPost,
)
from analytics.feed_ranker import rank_for_you_queryset
from analytics.trending import compute_trending_tags

from .serializers import (
    CommentSerializer,
    OrbitListSerializer,
    PollVoteSerializer,
    PostDraftSerializer,
    PostEditHistorySerializer,
    PostMediaSerializer,
    PostSerializer,
    QuestionAnswerSerializer,
    SavedCollectionSerializer,
    ScheduledMediaSerializer,
    ScheduledPostSerializer,
    UserSerializer,
    reaction_counts_for_comment,
    reaction_counts_for_post,
)

VALID_REACTIONS = {r[0] for r in Reaction.REACTION_TYPES}
User = get_user_model()


def _follows(viewer, author_id):
    if not viewer:
        return False
    return Follow.objects.filter(
        follower_id=viewer.id, following_id=author_id
    ).exists()


def can_view_post(post, viewer):
    if post.visibility == 'followers':
        if viewer and (viewer.id == post.user_id or _follows(viewer, post.user_id)):
            return True
        return False
    if post.visibility == 'subscribers':
        if viewer and viewer.id == post.user_id:
            return True
        if not viewer:
            return False
        from subscriptions.models import CreatorSubscription

        sub = CreatorSubscription.objects.filter(
            fan_id=viewer.id, creator_id=post.user_id, status='active',
        ).select_related('tier').first()
        if not sub:
            return False
        if post.required_tier_id and sub.tier.price_usd_cents < post.required_tier.price_usd_cents:
            return False
        return True
    return True


def can_reply_to_post(post, viewer):
    if not viewer:
        return False
    if viewer.id == post.user_id:
        return True
    control = post.reply_control or 'everyone'
    if control == 'everyone':
        return True
    if control == 'nobody':
        return False
    if control == 'followers':
        return _follows(viewer, post.user_id)
    return True


def _snippet(text, max_len=60):
    text = (text or '').strip()
    return text if len(text) <= max_len else f"{text[:max_len].strip()}…"


def _subscriber_gate_q(viewer):
    """Q clause matching subscriber-only posts the viewer has paid access
    to: any active subscription unlocks a post with no required_tier; a post
    with a required_tier needs a subscription at that tier's price or higher,
    to that same creator."""
    from django.db.models import Exists, OuterRef

    from subscriptions.models import CreatorSubscription

    if not viewer:
        return Q(pk__in=[])
    has_any_sub = CreatorSubscription.objects.filter(
        fan_id=viewer.id, creator_id=OuterRef('user_id'), status='active',
    )
    has_sufficient_tier_sub = CreatorSubscription.objects.filter(
        fan_id=viewer.id, creator_id=OuterRef('user_id'), status='active',
        tier__price_usd_cents__gte=OuterRef('required_tier__price_usd_cents'),
    )
    return (
        (Q(visibility='subscribers', required_tier__isnull=True) & Exists(has_any_sub))
        | (Q(visibility='subscribers', required_tier__isnull=False) & Exists(has_sufficient_tier_sub))
    )


def _exclude_shadow_banned(qs, viewer):
    """Shadow-banned authors' content is invisible to everyone except
    themselves — that's the point of the mechanic (they aren't told)."""
    if viewer:
        return qs.exclude(Q(user__is_shadow_banned=True) & ~Q(user_id=viewer.id))
    return qs.exclude(user__is_shadow_banned=True)


def _apply_feed_social_filters(qs, viewer):
    qs = _exclude_shadow_banned(qs, viewer)
    if not viewer:
        return qs
    hidden_authors = feed_hidden_author_ids(viewer.id)
    if hidden_authors:
        qs = qs.exclude(user_id__in=hidden_authors)
    see_less = FeedFeedback.objects.filter(
        user_id=viewer.id, feedback_type='see_less',
    ).values_list('author_id', flat=True)
    if see_less:
        qs = qs.exclude(user_id__in=see_less)
    hidden_posts = FeedFeedback.objects.filter(
        user_id=viewer.id,
        feedback_type__in=('not_interested', 'hide_post'),
    ).values_list('post_id', flat=True)
    if hidden_posts:
        qs = qs.exclude(id__in=hidden_posts)
    return qs


SEARCH_CATEGORIES = {
    'users', 'posts', 'reels', 'ideas', 'stories', 'bottles', 'shop', 'challenges',
}


class SearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({
                'users': [],
                'posts': [],
                'reels': [],
                'ideas': [],
                'stories': [],
                'bottles': [],
                'shop': [],
                'challenges': [],
            })

        category = request.query_params.get('category')
        if category in SEARCH_CATEGORIES:
            return self._paginated_category(request, query, category)

        users = User.objects.filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        )
        viewer = user_from_request(request)
        if viewer:
            users = users.exclude(id__in=feed_hidden_author_ids(viewer.id))
        users = users[:5]
        posts = Post.objects.filter(
            Q(text__icontains=query) | Q(tags__icontains=query)
        ).select_related('user').order_by('-created_at')[:5]
        reels = Reel.objects.filter(
            Q(caption__icontains=query) | Q(tags__icontains=query)
        ).select_related('user').order_by('-created_at')[:5]
        ideas = Idea.objects.filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        ).select_related('owner').order_by('-created_at')[:5]
        bottles = MessageBottle.objects.filter(
            message__icontains=query
        ).select_related('sender').order_by('-created_at')[:5]
        stories = Story.objects.filter(
            Q(title__icontains=query) | Q(premise__icontains=query)
        ).select_related('owner').order_by('-updated_at')[:5]
        shop_items = ShopItem.objects.filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        ).select_related('creator').order_by('-created_at')[:5]
        challenges = Challenge.objects.filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        ).order_by('-created_at')[:5]

        user_results = []
        for user in users:
            avatar = None
            if getattr(user, 'avatar', None):
                avatar = request.build_absolute_uri(user.avatar.url)
            full = f"{user.first_name or ''} {user.last_name or ''}".strip()
            user_results.append({
                'id': user.id,
                'username': user.username,
                'name': full or user.username,
                'avatar': avatar,
            })

        post_results = [{
            'id': post.id,
            'snippet': _snippet(post.text),
            'author': post.user.username if post.user else '',
            'tags': post.tags or [],
        } for post in posts]
        reel_results = [{
            'id': reel.id,
            'caption': _snippet(reel.caption),
            'author': reel.user.username if reel.user else '',
            'tags': reel.tags or [],
        } for reel in reels]
        idea_results = [{
            'id': idea.id,
            'title': idea.title,
            'description': _snippet(idea.description),
            'owner': idea.owner.username if idea.owner else '',
        } for idea in ideas]
        bottle_results = [{
            'id': bottle.id,
            'message': _snippet(bottle.message),
            'emotion_type': bottle.emotion_type,
            'sender': bottle.sender.username if bottle.sender else '',
        } for bottle in bottles]
        story_results = [{
            'id': story.id,
            'title': story.title,
            'description': _snippet(story.premise),
            'owner': story.owner.username if story.owner else '',
        } for story in stories]
        shop_results = [{
            'id': item.id,
            'name': item.name,
            'description': _snippet(item.description),
            'creator': item.creator.username if item.creator else '',
            'price': item.price,
        } for item in shop_items]
        challenge_results = [{
            'id': ch.id,
            'title': ch.title,
            'description': _snippet(ch.description),
            'type': ch.type,
        } for ch in challenges]

        return Response({
            'users': user_results,
            'posts': post_results,
            'reels': reel_results,
            'ideas': idea_results,
            'stories': story_results,
            'bottles': bottle_results,
            'shop': shop_results,
            'challenges': challenge_results,
        })

    def _paginated_category(self, request, query, category):
        """Full pagination for a single search category (used by 'view all')."""
        try:
            limit = int(request.query_params.get('limit', 20))
        except (TypeError, ValueError):
            limit = 20
        limit = max(1, min(limit, 50))
        try:
            offset = int(request.query_params.get('offset', 0))
        except (TypeError, ValueError):
            offset = 0
        offset = max(0, offset)

        if category == 'users':
            qs = User.objects.filter(
                Q(username__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            )
            viewer = user_from_request(request)
            if viewer:
                qs = qs.exclude(id__in=feed_hidden_author_ids(viewer.id))
            count = qs.count()
            page = list(qs[offset:offset + limit])
            results = []
            for user in page:
                avatar = None
                if getattr(user, 'avatar', None):
                    avatar = request.build_absolute_uri(user.avatar.url)
                full = f"{user.first_name or ''} {user.last_name or ''}".strip()
                results.append({
                    'id': user.id,
                    'username': user.username,
                    'name': full or user.username,
                    'avatar': avatar,
                })
        elif category == 'posts':
            qs = Post.objects.filter(
                Q(text__icontains=query) | Q(tags__icontains=query)
            ).select_related('user').order_by('-created_at')
            count = qs.count()
            page = list(qs[offset:offset + limit])
            results = [{
                'id': post.id,
                'snippet': _snippet(post.text),
                'author': post.user.username if post.user else '',
                'tags': post.tags or [],
            } for post in page]
        elif category == 'reels':
            qs = Reel.objects.filter(
                Q(caption__icontains=query) | Q(tags__icontains=query)
            ).select_related('user').order_by('-created_at')
            count = qs.count()
            page = list(qs[offset:offset + limit])
            results = [{
                'id': reel.id,
                'caption': _snippet(reel.caption),
                'author': reel.user.username if reel.user else '',
                'tags': reel.tags or [],
            } for reel in page]
        elif category == 'ideas':
            qs = Idea.objects.filter(
                Q(title__icontains=query) | Q(description__icontains=query)
            ).select_related('owner').order_by('-created_at')
            count = qs.count()
            page = list(qs[offset:offset + limit])
            results = [{
                'id': idea.id,
                'title': idea.title,
                'description': _snippet(idea.description),
                'owner': idea.owner.username if idea.owner else '',
            } for idea in page]
        elif category == 'stories':
            qs = Story.objects.filter(
                Q(title__icontains=query) | Q(premise__icontains=query)
            ).select_related('owner').order_by('-updated_at')
            count = qs.count()
            page = list(qs[offset:offset + limit])
            results = [{
                'id': story.id,
                'title': story.title,
                'description': _snippet(story.premise),
                'owner': story.owner.username if story.owner else '',
            } for story in page]
        elif category == 'bottles':
            qs = MessageBottle.objects.filter(
                message__icontains=query
            ).select_related('sender').order_by('-created_at')
            count = qs.count()
            page = list(qs[offset:offset + limit])
            results = [{
                'id': bottle.id,
                'message': _snippet(bottle.message),
                'emotion_type': bottle.emotion_type,
                'sender': bottle.sender.username if bottle.sender else '',
            } for bottle in page]
        elif category == 'shop':
            qs = ShopItem.objects.filter(
                Q(name__icontains=query) | Q(description__icontains=query)
            ).select_related('creator').order_by('-created_at')
            count = qs.count()
            page = list(qs[offset:offset + limit])
            results = [{
                'id': item.id,
                'name': item.name,
                'description': _snippet(item.description),
                'creator': item.creator.username if item.creator else '',
                'price': item.price,
            } for item in page]
        else:
            qs = Challenge.objects.filter(
                Q(title__icontains=query) | Q(description__icontains=query)
            ).order_by('-created_at')
            count = qs.count()
            page = list(qs[offset:offset + limit])
            results = [{
                'id': ch.id,
                'title': ch.title,
                'description': _snippet(ch.description),
                'type': ch.type,
            } for ch in page]

        return Response({
            'results': results,
            'count': count,
            'has_more': offset + limit < count,
        })


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer

    def get_permissions(self):
        if self.action in (
            'list', 'retrieve', 'trending', 'trending_tags', 'increment_views', 'share', 'reactors',
        ):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        viewer = user_from_request(self.request)
        if viewer:
            ctx['saved_ids'] = set(
                SavedPost.objects.filter(user=viewer).values_list(
                    'post_id', flat=True
                )
            )
            ctx['reposted_original_ids'] = set(
                Post.objects.filter(
                    user=viewer, text='', repost_of__isnull=False
                ).values_list('repost_of_id', flat=True)
            )
            from users.models import Follow
            ctx['following_ids'] = set(
                Follow.objects.filter(follower_id=viewer.id).values_list(
                    'following_id', flat=True
                )
            )
        else:
            ctx['following_ids'] = set()
        return ctx

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        limit_param = request.query_params.get('limit')
        offset_param = request.query_params.get('offset')
        # Backward-compatible: without limit/offset, return a plain array
        # (unchanged behavior for existing consumers). With them, return a
        # paginated envelope for infinite scroll.
        if limit_param is None and offset_param is None:
            return Response(self.get_serializer(qs, many=True).data)
        count = qs.count()
        try:
            limit = int(limit_param) if limit_param is not None else 10
        except (TypeError, ValueError):
            limit = 10
        limit = max(1, min(limit, 50))
        try:
            offset = int(offset_param) if offset_param is not None else 0
        except (TypeError, ValueError):
            offset = 0
        offset = max(0, offset)
        page = list(qs[offset:offset + limit])
        data = self.get_serializer(page, many=True).data
        return Response({
            'results': data,
            'count': count,
            'has_more': offset + limit < count,
        })

    def get_queryset(self):
        qs = (
            Post.objects.all()
            .select_related('user', 'user__profile', 'community', 'shared_reel', 'shared_reel__user', 'crosspost_of', 'crosspost_of__user')
            .prefetch_related(
                'media',
                Prefetch(
                    'reactions',
                    queryset=Reaction.objects.select_related('user').order_by('-created_at'),
                ),
            )
            .annotate(thread_member_count=Count('thread_members', distinct=True))
            .order_by('-created_at')
        )
        if self.action != 'list':
            return qs
        # Hide moderation hard-blocks from the public feed; owners still see own posts.
        viewer = user_from_request(self.request)
        if viewer:
            qs = qs.filter(Q(is_active=True) | Q(user_id=viewer.id))
        else:
            qs = qs.filter(is_active=True)
        # In the main feed, only surface thread roots + standalone posts —
        # thread continuations are read via the /thread/ endpoint.
        qs = qs.filter(thread_root__isnull=True)
        author_id = (
            self.request.query_params.get('author')
            or self.request.query_params.get('user')
        )
        profile_author_view = bool(author_id)
        if author_id:
            qs = qs.filter(user_id=author_id)
        tag = self.request.query_params.get('tag')
        if tag:
            qs = qs.filter(tags__contains=[tag])
        feed = self.request.query_params.get('feed')
        following_ids = []
        if viewer:
            following_ids = list(
                Follow.objects.filter(follower_id=viewer.id).values_list(
                    'following_id', flat=True
                )
            )
        if feed == 'following' and viewer:
            qs = qs.filter(user_id__in=following_ids)
        # Audience control: hide followers-only and subscriber-only posts
        # from viewers who aren't a follower / an active paid subscriber.
        # Following only grants access to public/followers-only posts — it
        # must not also unlock subscriber-gated ones.
        if viewer:
            qs = qs.filter(
                Q(visibility='public')
                | Q(user_id=viewer.id)
                | Q(user_id__in=following_ids, visibility__in=['public', 'followers'])
                | _subscriber_gate_q(viewer)
            )
        else:
            qs = qs.filter(visibility='public')

        qs = _apply_feed_social_filters(qs, viewer)

        if profile_author_view:
            # Pinned signals float to the top of a profile grid.
            return qs.order_by('-is_profile_pinned', '-profile_pinned_at', '-created_at')

        if feed == 'community':
            from communities.models import Community

            community_ref = self.request.query_params.get('community')
            if community_ref:
                if str(community_ref).isdigit():
                    community = Community.objects.filter(pk=community_ref).first()
                else:
                    community = Community.objects.filter(slug=community_ref).first()
                if not community:
                    return qs.none()
                if community.privacy == 'private':
                    is_member = bool(viewer) and community.memberships.filter(
                        user_id=viewer.id, status='approved',
                    ).exists()
                    if not is_member:
                        return qs.none()
                qs = qs.filter(community_id=community.id)
            else:
                qs = qs.none()
            sort = (self.request.query_params.get('sort') or 'new').lower()
            qs = qs.annotate(
                _net_vote_score=Coalesce(
                    Sum(Case(
                        When(votes__value=PostVote.BOOST, then=1),
                        When(votes__value=PostVote.DIM, then=-1),
                        default=0,
                        output_field=IntegerField(),
                    )),
                    0,
                ),
            )
            if sort == 'top':
                return qs.order_by(
                    '-is_community_pinned', '-community_pinned_at',
                    '-_net_vote_score', '-created_at',
                )
            if sort == 'hot':
                return qs.annotate(
                    _age_hours=ExpressionWrapper(
                        Extract(Now() - F('created_at'), 'epoch') / 3600.0,
                        output_field=FloatField(),
                    ),
                ).annotate(
                    _hot_score=ExpressionWrapper(
                        (F('_net_vote_score') + 1.0) / (F('_age_hours') + 2),
                        output_field=FloatField(),
                    ),
                ).order_by(
                    '-is_community_pinned', '-community_pinned_at',
                    '-_hot_score', '-created_at',
                )
            if sort == 'controversial':
                return qs.annotate(
                    _boost_c=Coalesce(Sum(Case(
                        When(votes__value=PostVote.BOOST, then=1),
                        default=0, output_field=IntegerField(),
                    )), 0),
                    _dim_c=Coalesce(Sum(Case(
                        When(votes__value=PostVote.DIM, then=1),
                        default=0, output_field=IntegerField(),
                    )), 0),
                ).annotate(
                    _controversy=ExpressionWrapper(
                        (F('_boost_c') + F('_dim_c')) * 1.0
                        / (Abs(F('_boost_c') - F('_dim_c')) + 1),
                        output_field=FloatField(),
                    ),
                ).order_by(
                    '-is_community_pinned', '-community_pinned_at',
                    '-_controversy', '-created_at',
                )
            return qs.order_by(
                '-is_community_pinned', '-community_pinned_at', '-created_at',
            )

        # Resonance: posts from communities the viewer joined
        if feed in ('joined', 'resonance') and viewer:
            from communities.models import CommunityMembership
            joined_ids = list(
                CommunityMembership.objects.filter(
                    user_id=viewer.id, status='approved',
                ).values_list('community_id', flat=True)
            )
            qs = qs.filter(community_id__in=joined_ids)
            sort = (self.request.query_params.get('sort') or 'hot').lower()
            qs = qs.annotate(
                _net_vote_score=Coalesce(
                    Sum(Case(
                        When(votes__value=PostVote.BOOST, then=1),
                        When(votes__value=PostVote.DIM, then=-1),
                        default=0,
                        output_field=IntegerField(),
                    )),
                    0,
                ),
            )
            if sort == 'top':
                return qs.order_by('-_net_vote_score', '-created_at')
            if sort == 'new':
                return qs.order_by('-created_at')
            return qs.annotate(
                _age_hours=ExpressionWrapper(
                    Extract(Now() - F('created_at'), 'epoch') / 3600.0,
                    output_field=FloatField(),
                ),
            ).annotate(
                _hot_score=ExpressionWrapper(
                    (F('_net_vote_score') + 1.0) / (F('_age_hours') + 2),
                    output_field=FloatField(),
                ),
            ).order_by('-_hot_score', '-created_at')

        if feed == 'following' and viewer:
            return qs.order_by('-created_at')
        if feed == 'discover':
            if viewer:
                qs = qs.exclude(user_id__in=following_ids + [viewer.id])
            return qs.annotate(
                _boost_active=Case(
                    When(is_boosted=True, boost_expires_at__gt=timezone.now(), then=1),
                    default=0,
                    output_field=IntegerField(),
                ),
            ).order_by('-_boost_active', '-likes_count', '-views', '-comments_count', '-created_at')
        if feed == 'top':
            return qs.annotate(
                _net_vote_score=Coalesce(
                    Sum(Case(
                        When(votes__value=PostVote.BOOST, then=1),
                        When(votes__value=PostVote.DIM, then=-1),
                        default=0,
                        output_field=IntegerField(),
                    )),
                    0,
                ),
            ).order_by('-_net_vote_score', '-created_at')
        if feed in ('for_you', 'all', None) and viewer:
            return rank_for_you_queryset(qs, viewer, following_ids)
        return qs.order_by('-created_at')

    def retrieve(self, request, *args, **kwargs):
        post = self.get_object()
        if not can_view_post(post, user_from_request(request)):
            return Response({'error': 'This post is limited.'}, status=403)
        return super().retrieve(request, *args, **kwargs)

    def perform_create(self, serializer):
        post_type = (self.request.data.get('post_type') or 'normal').lower()
        if post_type not in ('normal', 'poll', 'question'):
            post_type = 'normal'
        poll_options_raw = self.request.data.get('poll_options', [])
        question_mode = self.request.data.get('question_mode')  # ignored; kept for frontend parity
        user = user_from_request(self.request)
        save_kwargs = {
            'user': user,
            'post_type': post_type,
        }
        # Apply Signal publish default when reply_control omitted.
        if 'reply_control' not in getattr(self.request, 'data', {}):
            try:
                from preferences.models import UserPreferences
                prefs, _ = UserPreferences.objects.get_or_create(user=user)
                save_kwargs['reply_control'] = prefs.default_reply_control or 'everyone'
            except Exception:
                pass
        post = serializer.save(**save_kwargs)
        if post_type == 'poll' and isinstance(poll_options_raw, (list, tuple)):
            options = [opt.strip() for opt in poll_options_raw if isinstance(opt, str) and opt.strip()]
            for idx, text in enumerate(options[:8]):
                PollOption.objects.create(post=post, text=text, order=idx)
        # Thread continuation: link this post to an existing chain owned by
        # the same user. ``thread_parent`` is the post being continued from.
        thread_parent_id = self.request.data.get('thread_parent')
        if thread_parent_id:
            parent = Post.objects.filter(id=thread_parent_id, user=user).first()
            if parent:
                root = parent.thread_root or parent
                next_seq = (
                    Post.objects.filter(thread_root_id=root.id)
                    .aggregate(m=Max('thread_seq'))['m']
                    or parent.thread_seq
                    or 0
                ) + 1
                post.thread_root = root
                post.thread_seq = next_seq
                post.save(update_fields=['thread_root', 'thread_seq'])
        inspiration_question_id = self.request.data.get('inspiration_question_id')
        if inspiration_question_id:
            from questions.models import Question
            from questions.feedback import record_question_published

            question = Question.objects.filter(pk=inspiration_question_id, is_active=True).first()
            if question:
                post.inspiration_question = question
                post.save(update_fields=['inspiration_question'])
                record_question_published(user, question)
        community_id = self.request.data.get('community_id')
        if community_id:
            from communities.models import Community
            from communities.views import _is_banned, _is_moderator

            community = Community.objects.filter(pk=community_id).first()
            # Posting into a community requires approved membership in it.
            if community and community.memberships.filter(user_id=user.id, status='approved').exists():
                if _is_banned(user, community):
                    pass  # ban checked in create()
                elif community.posting_permission == 'mods' and not _is_moderator(user, community):
                    pass  # leave community unset; create() should have rejected
                else:
                    flair = str(self.request.data.get('flair') or '')[:40]
                    if flair and community.flair_options:
                        allowed = {str(opt).strip() for opt in community.flair_options if str(opt).strip()}
                        if allowed and flair not in allowed:
                            flair = ''
                    post.community = community
                    post.flair = flair
                    if community.spoilers_enabled:
                        post.is_spoiler = bool(self.request.data.get('is_spoiler'))
                    post.save(update_fields=['community', 'flair', 'is_spoiler'])
                    Community.objects.filter(pk=community.id).update(posts_count=F('posts_count') + 1)
        shared_reel_id = self.request.data.get('shared_reel_id')
        if shared_reel_id:
            from reels.models import Reel

            reel = Reel.objects.filter(pk=shared_reel_id, is_active=True).first()
            if reel:
                post.shared_reel = reel
                post.save(update_fields=['shared_reel'])
                Reel.objects.filter(pk=reel.id).update(shares_count=F('shares_count') + 1)
        return post

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        post_type = (request.data.get('post_type') or 'normal').lower()
        if post_type not in ('normal', 'poll', 'question'):
            post_type = 'normal'
        if post_type == 'poll':
            options = request.data.get('poll_options', [])
            valid_options = [opt for opt in options if isinstance(opt, str) and opt.strip()]
            if len(valid_options) < 2:
                return Response({'error': 'Polls need at least two options.'}, status=400)
        if post_type == 'question':
            text = (request.data.get('text') or '').strip()
            if not text:
                return Response({'error': 'Question posts need text.'}, status=400)
        community_id = request.data.get('community_id')
        if community_id:
            from communities.models import Community
            from communities.views import _is_banned, _is_moderator

            community = Community.objects.filter(pk=community_id).first()
            if community and _is_banned(user, community):
                return Response({'error': 'You are banned from this community.'}, status=403)
            if community:
                membership = community.memberships.filter(user_id=user.id, status='approved').first()
                if not membership:
                    return Response({'error': 'Join the community before posting.'}, status=403)
                if community.posting_permission == 'mods' and not _is_moderator(user, community):
                    return Response({'error': 'Only moderators can post in this community.'}, status=403)
        response = super().create(request, *args, **kwargs)
        if response.status_code == 201:
            try:
                from moderation.hooks import enforce_moderation_result, soft_moderate_content
                result = soft_moderate_content(
                    text=request.data.get('text') or '',
                    content_type='post',
                    object_id=response.data.get('id'),
                    user=user,
                )
                if result.get('hard_block'):
                    enforce_moderation_result(
                        result,
                        content_type='post',
                        object_id=response.data.get('id'),
                    )
            except Exception:
                pass
        return response

    def update(self, request, *args, **kwargs):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if post.user_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        self._prev_text = post.text
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        prev_text = getattr(self, '_prev_text', None)
        post = serializer.save()
        if prev_text is not None and prev_text != post.text:
            PostEditHistory.objects.create(post=post, previous_text=prev_text)
            post.edited_at = timezone.now()
            post.save(update_fields=['edited_at'])

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if post.user_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        original = instance.repost_of if instance.repost_of_id else None
        super().perform_destroy(instance)
        if original is not None:
            original.reposts_count = original.reposts.count()
            original.save(update_fields=['reposts_count'])

    @action(
        detail=True,
        methods=['post'],
        parser_classes=[MultiPartParser, FormParser],
    )
    def add_media(self, request, pk=None):
        post = self.get_object()
        files = request.FILES.getlist('media')
        alts = request.data.getlist('alt_text') if hasattr(request.data, 'getlist') else []
        start = post.media.count()
        created = []
        for idx, media_file in enumerate(files):
            content_type = getattr(media_file, 'content_type', '') or ''
            if content_type.startswith('video'):
                media_type = 'video'
            elif content_type.startswith('audio'):
                media_type = 'audio'
            else:
                media_type = 'image'
            alt = alts[idx] if idx < len(alts) else ''
            created.append(
                PostMedia.objects.create(
                    post=post,
                    media_file=media_file,
                    media_type=media_type,
                    alt_text=(alt or '')[:280],
                    order=start + idx,
                )
            )
        serializer = PostMediaSerializer(
            created, many=True, context={'request': request}
        )
        return Response(serializer.data, status=201)

    @action(detail=False, methods=['get'])
    def trending(self, request):
        cache_key = 'posts:trending'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        qs = Post.objects.all().order_by(
            '-likes_count', '-views', '-created_at'
        )[:5]
        payload = self.get_serializer(qs, many=True).data
        cache.set(cache_key, payload, 300)
        return Response(payload)

    @action(detail=False, methods=['get'])
    def trending_tags(self, request):
        cached = cache.get('posts:trending_tags')
        if cached is not None:
            return Response(cached)
        payload = compute_trending_tags(limit=12)
        cache.set('posts:trending_tags', payload, 300)
        return Response(payload)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def increment_views(self, request, pk=None):
        post = self.get_object()
        post.views = F('views') + 1
        post.save(update_fields=['views'])
        post.refresh_from_db()
        return Response({'views': post.views})

    increment_views.throttle_classes = [AnonRateThrottle]

    @action(detail=False, methods=['get'])
    def my_stats(self, request):
        user, err = require_user(request)
        if err:
            return err
        qs = Post.objects.filter(user=user)
        totals = qs.aggregate(
            total_views=Sum('views'),
            total_likes=Sum('likes_count'),
            total_comments=Sum('comments_count'),
            total_shares=Sum('shares_count'),
        )
        top = qs.order_by('-views')[:5]
        inspired = qs.filter(inspiration_question__isnull=False)
        inspiration_by_category = {
            row['inspiration_question__category']: row['c']
            for row in inspired.values('inspiration_question__category').annotate(c=Count('id')).order_by('-c')
            if row['inspiration_question__category']
        }
        return Response({
            'total_posts': qs.count(),
            'total_views': totals['total_views'] or 0,
            'total_likes': totals['total_likes'] or 0,
            'total_comments': totals['total_comments'] or 0,
            'total_shares': totals['total_shares'] or 0,
            'inspiration_published': inspired.count(),
            'inspiration_by_category': inspiration_by_category,
            'top_posts': PostSerializer(
                top, many=True, context=self.get_serializer_context(),
            ).data,
        })

    @action(detail=False, methods=['get'])
    def saved(self, request):
        user, err = require_user(request)
        if err:
            return err
        saves = SavedPost.objects.filter(user=user).order_by('-created_at')
        collection_id = request.query_params.get('collection_id')
        if collection_id:
            saves = saves.filter(collection_id=collection_id)
        post_ids = list(saves.values_list('post_id', flat=True))
        if not post_ids:
            return Response([])
        ordering = Case(
            *[When(id=post_id, then=position) for position, post_id in enumerate(post_ids)],
            output_field=IntegerField(),
        )
        qs = (
            Post.objects.filter(id__in=post_ids)
            .select_related('user')
            .order_by(ordering)
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def toggle_save(self, request, pk=None):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        collection = None
        collection_id = request.data.get('collection')
        if collection_id:
            collection = SavedCollection.objects.filter(
                id=collection_id, user=user
            ).first()
        with transaction.atomic():
            existing = SavedPost.objects.select_for_update().filter(user=user, post=post).first()
            if existing:
                # Re-saving into a different folder moves the post instead of unsaving.
                if collection is not None and existing.collection_id != collection.id:
                    existing.collection = collection
                    existing.save(update_fields=['collection'])
                    return Response({'saved': True, 'collection': collection.id})
                existing.delete()
                return Response({'saved': False})
            try:
                SavedPost.objects.create(user=user, post=post, collection=collection)
            except IntegrityError:
                return Response({'saved': True})
        return Response({
            'saved': True,
            'collection': collection.id if collection else None,
        })

    @action(detail=True, methods=['post'])
    def poll_vote(self, request, pk=None):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if post.post_type != 'poll':
            return Response({'error': 'Not a poll.'}, status=400)
        option_id = request.data.get('option_id')
        if not option_id:
            return Response({'error': 'option_id required.'}, status=400)
        try:
            option = PollOption.objects.get(id=option_id, post=post)
        except PollOption.DoesNotExist:
            return Response({'error': 'Option not found.'}, status=404)
        with transaction.atomic():
            existing = PollVote.objects.select_for_update().filter(post=post, user=user).first()
            if existing and existing.option_id == option.id:
                existing.delete()
            else:
                if existing:
                    existing.option = option
                    existing.save(update_fields=['option', 'created_at'])
                else:
                    PollVote.objects.create(post=post, user=user, option=option)
        return Response(PostSerializer(post, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def answer(self, request, pk=None):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if post.post_type != 'question':
            return Response({'error': 'Not a question post.'}, status=400)
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'Answer text is required.'}, status=400)
        answer = QuestionAnswer.objects.create(post=post, user=user, text=text)
        create_notification(
            recipient_id=post.user_id,
            actor_id=user.id,
            verb='comment',
            post=post,
            text='answered your question',
        )
        return Response(QuestionAnswerSerializer(answer).data, status=201)

    @action(detail=True, methods=['get'])
    def answers(self, request, pk=None):
        post = self.get_object()
        if post.post_type != 'question':
            return Response({'error': 'Not a question post.'}, status=400)
        viewer = user_from_request(request)
        # Only the author sees full answers; others see only whether they answered.
        if not viewer or viewer.id != post.user_id:
            return Response({
                'count': post.question_answers.count(),
                'answers': [],
                'my_answer': post.question_answers.filter(user_id=viewer.id if viewer else 0).values('text', 'created_at').first(),
            })
        qs = post.question_answers.select_related('user').order_by('-created_at')
        return Response({
            'count': qs.count(),
            'answers': QuestionAnswerSerializer(qs, many=True).data,
        })

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def share(self, request, pk=None):
        from .models import PostShareLog

        post = self.get_object()
        raw_channel = (request.data.get('channel') or 'unknown').lower()
        valid = {c for c, _ in PostShareLog.CHANNEL_CHOICES}
        channel = raw_channel if raw_channel in valid else 'unknown'
        user = user_from_request(request)

        post.shares_count = F('shares_count') + 1
        post.save(update_fields=['shares_count'])
        post.refresh_from_db()
        PostShareLog.objects.create(post=post, user=user, channel=channel)

        if user and user.id != post.user_id:
            first_share = PostShareLog.objects.filter(post=post, user=user).count() == 1
            if first_share:
                create_notification(
                    recipient_id=post.user_id,
                    actor_id=user.id,
                    verb='share',
                    post=post,
                    text='transmitted your signal',
                )
        return Response({'shares_count': post.shares_count, 'channel': channel})

    share.throttle_classes = [AnonRateThrottle]

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def feedback(self, request, pk=None):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        feedback_type = (request.data.get('type') or '').lower()
        valid = {c for c, _ in FeedFeedback.FEEDBACK_TYPES}
        if feedback_type not in valid:
            return Response({'error': 'Invalid feedback type.'}, status=400)

        undo = bool(request.data.get('undo'))
        if undo:
            qs = FeedFeedback.objects.filter(user=user, feedback_type=feedback_type)
            if feedback_type in ('not_interested', 'hide_post'):
                qs = qs.filter(post=post)
            else:
                qs = qs.filter(author_id=post.user_id)
            obj = qs.order_by('-id').first()
            if obj:
                obj.delete()
            return Response({'ok': True, 'type': feedback_type, 'undone': True})

        FeedFeedback.objects.create(
            user=user,
            post=post if feedback_type in ('not_interested', 'hide_post') else None,
            author_id=post.user_id if feedback_type == 'see_less' else None,
            feedback_type=feedback_type,
        )
        return Response({'ok': True, 'type': feedback_type})

    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        rtype = request.data.get('reaction')
        if rtype is not None and rtype not in VALID_REACTIONS:
            return Response({'error': 'Invalid reaction.'}, status=400)

        existing = Reaction.objects.filter(post=post, user=user).first()
        if rtype is None or (existing and existing.type == rtype):
            if existing:
                existing.delete()
            my_reaction = None
        elif existing:
            existing.type = rtype
            existing.save(update_fields=['type'])
            my_reaction = rtype
        else:
            Reaction.objects.create(post=post, user=user, type=rtype)
            my_reaction = rtype
            create_notification(
                recipient_id=post.user_id,
                actor_id=user.id,
                verb='reaction',
                post=post,
                text='reacted to your post',
            )

        total = post.reactions.count()
        post.likes_count = total
        post.save(update_fields=['likes_count'])
        return Response({
            'reaction_counts': reaction_counts_for_post(post),
            'my_reaction': my_reaction,
            'total': total,
        })

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def reactors(self, request, pk=None):
        post = self.get_object()
        rtype = request.query_params.get('type')
        qs = Reaction.objects.filter(post=post).select_related('user').order_by('-created_at')
        if rtype in VALID_REACTIONS:
            qs = qs.filter(type=rtype)
        try:
            limit = min(int(request.query_params.get('limit', 40)), 80)
        except (TypeError, ValueError):
            limit = 40
        rows = [
            {
                'user': UserSerializer(reaction.user).data,
                'type': reaction.type,
                'created_at': reaction.created_at.isoformat(),
            }
            for reaction in qs[:limit]
        ]
        return Response({
            'results': rows,
            'count': qs.count(),
            'reaction_counts': reaction_counts_for_post(post),
        })

    @staticmethod
    def _sync_reposts(target):
        target.reposts_count = target.reposts.count()
        target.save(update_fields=['reposts_count'])

    @action(detail=True, methods=['post'])
    def repost(self, request, pk=None):
        """Echo (pure repost, toggleable) or Quote (repost with commentary).

        Body: optional ``{text}``.
        - With non-empty ``text`` → creates a **quote** post (always new).
        - Without ``text`` → toggles a **pure echo** of the original.

        Echoes of echoes are dereferenced to the true original so chains
        never form.
        """
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err

        target = post
        if post.repost_of_id and not (post.text or '').strip():
            target = post.repost_of or post

        text = (request.data.get('text') or '').strip()
        if text:
            quote = Post.objects.create(
                user=user, text=text, post_type='normal', repost_of=target,
            )
            self._sync_reposts(target)
            if target.user_id != user.id:
                create_notification(
                    recipient_id=target.user_id,
                    actor_id=user.id,
                    verb='reaction',
                    post=target,
                    text='quoted your post',
                )
            return Response(
                PostSerializer(quote, context={'request': request}).data,
                status=201,
            )

        existing = Post.objects.filter(
            repost_of=target, user=user, text='',
        ).first()
        if existing:
            existing.delete()
            self._sync_reposts(target)
            return Response({'reposted': False, 'reposts_count': target.reposts_count})

        echo = Post.objects.create(
            user=user, text='', post_type='normal', repost_of=target,
        )
        self._sync_reposts(target)
        if target.user_id != user.id:
            create_notification(
                recipient_id=target.user_id,
                actor_id=user.id,
                verb='reaction',
                post=target,
                text='reposted your post',
            )
        return Response(
            {
                'reposted': True,
                'reposts_count': target.reposts_count,
                'post': PostSerializer(echo, context={'request': request}).data,
            },
            status=201,
        )

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def edits(self, request, pk=None):
        """Return the edit history (previous text snapshots) for a post."""
        post = self.get_object()
        if not can_view_post(post, user_from_request(request)):
            return Response({'error': 'This post is limited.'}, status=403)
        history = post.edit_history.all()
        return Response(PostEditHistorySerializer(history, many=True).data)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def thread(self, request, pk=None):
        """Return the full ordered thread chain this post belongs to."""
        post = self.get_object()
        root_id = post.thread_root_id or post.id
        members = (
            Post.objects.filter(Q(id=root_id) | Q(thread_root_id=root_id))
            .select_related('user')
            .prefetch_related('media', 'reactions', 'poll_options')
            .order_by('thread_seq', 'created_at')
        )
        serializer = self.get_serializer(members, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='pin-profile')
    def pin_profile(self, request, pk=None):
        """Toggle pinned signal on the owner's profile (max Post.MAX_PROFILE_PINS)."""
        user, err = require_user(request)
        if err:
            return err
        post = self.get_object()
        if post.user_id != user.id:
            return Response({'error': 'Only the author can pin this signal.'}, status=403)
        with transaction.atomic():
            post = Post.objects.select_for_update().get(pk=post.pk)
            if post.is_profile_pinned:
                post.is_profile_pinned = False
                post.profile_pinned_at = None
                post.save(update_fields=['is_profile_pinned', 'profile_pinned_at'])
                return Response({
                    'is_profile_pinned': False,
                    'profile_pinned_at': None,
                })
            pinned_count = Post.objects.filter(
                user=user, is_profile_pinned=True,
            ).count()
            if pinned_count >= Post.MAX_PROFILE_PINS:
                return Response(
                    {
                        'error': f'You can pin up to {Post.MAX_PROFILE_PINS} signals.',
                        'max': Post.MAX_PROFILE_PINS,
                    },
                    status=400,
                )
            post.is_profile_pinned = True
            post.profile_pinned_at = timezone.now()
            post.save(update_fields=['is_profile_pinned', 'profile_pinned_at'])
        return Response({
            'is_profile_pinned': True,
            'profile_pinned_at': post.profile_pinned_at,
        })

    @action(detail=True, methods=['post'], url_path='pin-community')
    def pin_community(self, request, pk=None):
        """Mod/admin toggle for Anchored Signal inside a community (max 3)."""
        from communities.views import _is_moderator

        user, err = require_user(request)
        if err:
            return err
        post = self.get_object()
        if not post.community_id:
            return Response({'error': 'Post is not in a community.'}, status=400)
        if not _is_moderator(user, post.community):
            return Response({'error': 'Only moderators can anchor community signals.'}, status=403)
        with transaction.atomic():
            post = Post.objects.select_for_update().get(pk=post.pk)
            if post.is_community_pinned:
                post.is_community_pinned = False
                post.community_pinned_at = None
                post.save(update_fields=['is_community_pinned', 'community_pinned_at'])
                return Response({'is_community_pinned': False})
            pinned = Post.objects.filter(
                community_id=post.community_id, is_community_pinned=True,
            ).count()
            if pinned >= Post.MAX_COMMUNITY_PINS:
                return Response(
                    {'error': f'At most {Post.MAX_COMMUNITY_PINS} anchored signals.'},
                    status=400,
                )
            post.is_community_pinned = True
            post.community_pinned_at = timezone.now()
            post.save(update_fields=['is_community_pinned', 'community_pinned_at'])
        return Response({
            'is_community_pinned': True,
            'community_pinned_at': post.community_pinned_at,
        })

    @action(detail=True, methods=['post'], url_path='cross-echo')
    def cross_echo(self, request, pk=None):
        """Cross-Echo: share this signal into another community."""
        from communities.models import Community
        from communities.views import _is_banned, _is_moderator

        user, err = require_user(request)
        if err:
            return err
        source = self.get_object()
        community_id = request.data.get('community_id')
        community_slug = request.data.get('community') or request.data.get('slug')
        if community_id:
            community = Community.objects.filter(pk=community_id).first()
        elif community_slug:
            community = Community.objects.filter(slug=community_slug).first()
        else:
            return Response({'error': 'community_id or community slug required.'}, status=400)
        if not community:
            return Response({'error': 'Community not found.'}, status=404)
        if _is_banned(user, community):
            return Response({'error': 'You are banned from this community.'}, status=403)
        membership = community.memberships.filter(user_id=user.id, status='approved').first()
        if not membership:
            return Response({'error': 'Join the community first.'}, status=403)
        if community.posting_permission == 'mods' and not _is_moderator(user, community):
            return Response({'error': 'Only moderators can post here.'}, status=403)
        if source.community_id == community.id:
            return Response({'error': 'Already in this community.'}, status=400)
        commentary = (request.data.get('text') or '').strip()
        flair = str(request.data.get('flair') or '')[:40]
        if flair and community.flair_options:
            allowed = {str(opt).strip() for opt in community.flair_options if str(opt).strip()}
            if allowed and flair not in allowed:
                flair = ''
        root = source.crosspost_of or source
        echo = Post.objects.create(
            user=user,
            text=commentary or (source.text or '')[:2000],
            post_type='normal',
            community=community,
            flair=flair,
            crosspost_of=root,
            visibility='public',
            reply_control=source.reply_control or 'everyone',
            is_spoiler=bool(request.data.get('is_spoiler')) or bool(source.is_spoiler),
        )
        Community.objects.filter(pk=community.id).update(posts_count=F('posts_count') + 1)
        return Response(
            PostSerializer(echo, context={'request': request}).data,
            status=201,
        )

    @action(detail=True, methods=['post'])
    def vote(self, request, pk=None):
        """Boost (+1) or dim (-1) a post — Reddit-style karma."""
        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        vote = request.data.get('vote')
        if vote not in ('boost', 'dim', None, ''):
            return Response({'error': 'Invalid vote.'}, status=400)

        existing = PostVote.objects.filter(post=post, user=user).first()
        old_contrib = 0
        if existing:
            old_contrib = 1 if existing.value == PostVote.BOOST else -1

        my_vote = None
        if not vote:
            if existing:
                existing.delete()
        else:
            value = PostVote.BOOST if vote == 'boost' else PostVote.DIM
            if existing:
                if existing.value == value:
                    existing.delete()
                else:
                    existing.value = value
                    existing.save(update_fields=['value'])
                    my_vote = vote
            else:
                PostVote.objects.create(post=post, user=user, value=value)
                my_vote = vote

        new_contrib = 1 if my_vote == 'boost' else (-1 if my_vote == 'dim' else 0)
        karma_delta = new_contrib - old_contrib
        if karma_delta and post.user_id != user.id:
            try:
                from users.models import Profile
                profile, _ = Profile.objects.get_or_create(user_id=post.user_id)
                Profile.objects.filter(pk=profile.pk).update(karma=F('karma') + karma_delta)
            except Exception:
                pass

        boost = PostVote.objects.filter(post=post, value=PostVote.BOOST).count()
        dim = PostVote.objects.filter(post=post, value=PostVote.DIM).count()
        return Response({
            'vote_score': boost - dim,
            'boost_count': boost,
            'dim_count': dim,
            'my_vote': my_vote,
        })

    BOOST_COST_COINS = 200
    BOOST_DURATION_HOURS = 24

    @action(detail=True, methods=['post'], url_path='boost-promote')
    def boost_promote(self, request, pk=None):
        """Spend coins to lift this post in for_you/discover feeds for a
        fixed window. Reuses shop's atomic Profile.points debit pattern."""
        from django.db import transaction as db_transaction
        from users.models import Profile

        post = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if post.user_id != user.id:
            return Response({'error': 'Only the author can boost this post.'}, status=403)
        if post.is_boost_active:
            return Response(
                {'error': 'This post is already boosted.', 'boost_expires_at': post.boost_expires_at},
                status=400,
            )

        with db_transaction.atomic():
            profile = Profile.objects.select_for_update().get_or_create(user=user)[0]
            if profile.points < self.BOOST_COST_COINS:
                return Response(
                    {'error': 'Insufficient coins.', 'balance': profile.points, 'cost': self.BOOST_COST_COINS},
                    status=400,
                )
            profile.points = F('points') - self.BOOST_COST_COINS
            profile.save(update_fields=['points'])
            post.is_boosted = True
            post.boost_expires_at = timezone.now() + timedelta(hours=self.BOOST_DURATION_HOURS)
            post.save(update_fields=['is_boosted', 'boost_expires_at'])
            profile.refresh_from_db(fields=['points'])

        return Response({
            'is_boosted': post.is_boosted,
            'boost_expires_at': post.boost_expires_at,
            'balance': profile.points,
        })


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    COMMENT_SORTS = {'best', 'top', 'new', 'old', 'controversial'}

    def _vote_score_annotation(self):
        return Coalesce(
            Sum(Case(
                When(votes__value=CommentVote.BOOST, then=1),
                When(votes__value=CommentVote.DIM, then=-1),
                default=0,
                output_field=IntegerField(),
            )),
            0,
        )

    def _boost_count_annotation(self):
        return Coalesce(
            Sum(Case(
                When(votes__value=CommentVote.BOOST, then=1),
                default=0,
                output_field=IntegerField(),
            )),
            0,
        )

    def _dim_count_annotation(self):
        return Coalesce(
            Sum(Case(
                When(votes__value=CommentVote.DIM, then=1),
                default=0,
                output_field=IntegerField(),
            )),
            0,
        )

    def get_queryset(self):
        qs = Comment.objects.filter(is_deleted=False).select_related(
            'user', 'post', 'quoted_comment',
        ).prefetch_related('reactions', 'votes')
        post_id = self.request.query_params.get('post')
        if post_id:
            qs = qs.filter(post_id=post_id)
        viewer = user_from_request(self.request)
        if self.action == 'list' and post_id:
            post = Post.objects.filter(pk=post_id).first()
            if post:
                # Restrict (IG-style): the post owner still sees every
                # comment (to moderate); everyone else — including the
                # restricted author seeing their own comment — has
                # comments from the owner's restricted list hidden, except
                # a viewer's own comments always stay visible to them.
                owner_restricted = restricted_user_ids(post.user_id)
                if owner_restricted and not (viewer and viewer.id == post.user_id):
                    if viewer:
                        qs = qs.filter(Q(user_id=viewer.id) | ~Q(user_id__in=owner_restricted))
                    else:
                        qs = qs.exclude(user_id__in=owner_restricted)
        if self.action == 'list':
            qs = qs.filter(parent__isnull=True)
            sort = (self.request.query_params.get('sort') or 'old').lower()
            if sort not in self.COMMENT_SORTS:
                sort = 'old'
            pin_order = F('pin_order').asc(nulls_last=True)
            if sort in ('best', 'top', 'controversial'):
                qs = qs.annotate(
                    boost_count=self._boost_count_annotation(),
                    dim_count=self._dim_count_annotation(),
                    vote_score=self._vote_score_annotation(),
                    _reaction_score=Count('reactions', distinct=True),
                    _reply_count=Count('replies', distinct=True),
                )
                if sort == 'top':
                    return qs.order_by(
                        pin_order, '-vote_score', '-_reaction_score',
                        '-_reply_count', '-created_at',
                    )
                if sort == 'controversial':
                    # Rewards near-even boost/dim splits weighted by total
                    # votes — a lopsided 10-boost/0-dim comment isn't
                    # controversial, a 5-boost/5-dim one is.
                    qs = qs.annotate(
                        _controversy=ExpressionWrapper(
                            (F('boost_count') + F('dim_count')) * 1.0
                            * Least(F('boost_count'), F('dim_count'))
                            / Greatest(Greatest(F('boost_count'), F('dim_count')), 1),
                            output_field=FloatField(),
                        ),
                    )
                    return qs.order_by(
                        pin_order, '-_controversy', '-_reaction_score', '-created_at',
                    )
                # 'best': a confidence-adjusted (Laplace-smoothed) score, so
                # a comment with 2 boosts/0 dims doesn't outrank one with
                # 20 boosts/18 dims just because its raw net score is higher
                # — the latter has far more signal behind a smaller margin.
                qs = qs.annotate(
                    _best_score=ExpressionWrapper(
                        (F('boost_count') - F('dim_count')) * 1.0
                        / (F('boost_count') + F('dim_count') + 2),
                        output_field=FloatField(),
                    ),
                )
                return qs.order_by(
                    pin_order, '-_best_score', '-_reaction_score',
                    '-_reply_count', '-created_at',
                )
            if sort == 'new':
                return qs.order_by(pin_order, '-created_at')
            return qs.order_by(pin_order, 'created_at')
        return qs.order_by('created_at')

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        count = qs.count()
        try:
            limit = int(request.query_params.get('limit', 20))
        except (TypeError, ValueError):
            limit = 20
        limit = max(1, min(limit, 50))
        try:
            offset = int(request.query_params.get('offset', 0))
        except (TypeError, ValueError):
            offset = 0
        offset = max(0, offset)
        page = list(qs[offset:offset + limit])
        data = self.get_serializer(page, many=True).data
        return Response({
            'results': data,
            'count': count,
            'has_more': offset + limit < count,
        })

    def _sync_count(self, post):
        post.comments_count = post.comments.count()
        post.save(update_fields=['comments_count'])

    def perform_create(self, serializer):
        user = user_from_request(self.request)
        post = serializer.validated_data['post']
        if is_blocked_between(user.id, post.user_id):
            raise ValidationError('Cannot comment on this post.')
        if not can_comment(user, post.user):
            raise ValidationError('Comments are restricted on this post.')
        from preferences.models import UserPreferences
        author_prefs, _ = UserPreferences.objects.get_or_create(user=post.user)
        comment_text = serializer.validated_data.get('text') or ''
        if text_has_hidden_word(comment_text, author_prefs.hidden_words or []):
            raise ValidationError('Comment contains blocked words.')
        comment = serializer.save(user=user)
        self._sync_count(comment.post)
        verb_text = (
            'replied to your comment'
            if comment.parent_id
            else 'commented on your post'
        )
        recipient_id = (
            comment.parent.user_id
            if comment.parent_id
            else comment.post.user_id
        )
        create_notification(
            recipient_id=recipient_id,
            actor_id=user.id,
            verb='comment',
            post=comment.post,
            text=verb_text,
        )
        try:
            from .realtime import push_post_comment
            from .serializers import CommentSerializer
            push_post_comment(comment.post_id, {
                'action': 'created',
                'comment_id': comment.id,
                'comment': CommentSerializer(
                    comment, context={'request': self.request, 'viewer_id': user.id},
                ).data,
            })
        except Exception:
            pass

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        post_id = request.data.get('post')
        if post_id:
            post = Post.objects.filter(id=post_id).first()
            if post and not can_reply_to_post(post, user):
                return Response(
                    {
                        'error': 'Echo-back is limited on this signal.',
                        'reply_control': post.reply_control or 'everyone',
                    },
                    status=403,
                )
        response = super().create(request, *args, **kwargs)
        if response.status_code == 201:
            try:
                from moderation.hooks import enforce_moderation_result, soft_moderate_content
                result = soft_moderate_content(
                    text=request.data.get('text') or '',
                    content_type='comment',
                    object_id=response.data.get('id'),
                    user=user,
                )
                if result.get('hard_block'):
                    enforce_moderation_result(
                        result,
                        content_type='comment',
                        object_id=response.data.get('id'),
                    )
            except Exception:
                pass
        return response

    def perform_update(self, serializer):
        comment = serializer.save()
        if 'text' in serializer.validated_data:
            comment.edited_at = timezone.now()
            comment.save(update_fields=['edited_at'])

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.user_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        post = instance.post
        instance.delete()
        self._sync_count(post)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.user_id != user.id and comment.post.user_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        rtype = request.data.get('reaction')
        if rtype is not None and rtype not in VALID_REACTIONS:
            return Response({'error': 'Invalid reaction.'}, status=400)

        existing = CommentReaction.objects.filter(
            comment=comment, user=user
        ).first()
        if rtype is None or (existing and existing.type == rtype):
            if existing:
                existing.delete()
            my_reaction = None
        elif existing:
            existing.type = rtype
            existing.save(update_fields=['type'])
            my_reaction = rtype
        else:
            CommentReaction.objects.create(
                comment=comment, user=user, type=rtype
            )
            my_reaction = rtype
            if comment.user_id != user.id:
                create_notification(
                    recipient_id=comment.user_id,
                    actor_id=user.id,
                    verb='reaction',
                    post=comment.post,
                    text='reacted to your comment',
                )

        return Response({
            'reaction_counts': reaction_counts_for_comment(comment),
            'my_reaction': my_reaction,
        })

    @action(detail=True, methods=['post'])
    def pin(self, request, pk=None):
        """Host anchors up to 3 top-level comments (ordered at top)."""
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.post.user_id != user.id:
            return Response({'error': 'Only the post author can pin.'}, status=403)
        if comment.parent_id is not None:
            return Response({'error': 'Only top-level comments can be pinned.'}, status=400)
        with transaction.atomic():
            if comment.pin_order:
                removed = comment.pin_order
                comment.pin_order = None
                comment.save(update_fields=['pin_order'])
                Comment.objects.filter(
                    post=comment.post, pin_order__gt=removed,
                ).update(pin_order=F('pin_order') - 1)
            else:
                pinned = Comment.objects.filter(
                    post=comment.post, pin_order__isnull=False,
                ).count()
                if pinned >= Comment.MAX_PINNED:
                    return Response(
                        {'error': f'Max {Comment.MAX_PINNED} anchored comments.'},
                        status=400,
                    )
                comment.pin_order = pinned + 1
                comment.save(update_fields=['pin_order'])
        return Response({
            'pin_order': comment.pin_order,
            'is_pinned': comment.pin_order is not None,
        })

    @action(detail=True, methods=['post'])
    def vote(self, request, pk=None):
        """Boost (+1) or dim (-1) a comment — Reddit-style signal strength."""
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        vote = request.data.get('vote')
        if vote not in ('boost', 'dim', None, ''):
            return Response({'error': 'Invalid vote.'}, status=400)

        existing = CommentVote.objects.filter(comment=comment, user=user).first()
        old_contrib = 0
        if existing:
            old_contrib = 1 if existing.value == CommentVote.BOOST else -1

        my_vote = None
        if not vote:
            if existing:
                existing.delete()
        else:
            value = CommentVote.BOOST if vote == 'boost' else CommentVote.DIM
            if existing:
                if existing.value == value:
                    existing.delete()
                else:
                    existing.value = value
                    existing.save(update_fields=['value'])
                    my_vote = vote
            else:
                CommentVote.objects.create(comment=comment, user=user, value=value)
                my_vote = vote

        new_contrib = 1 if my_vote == 'boost' else (-1 if my_vote == 'dim' else 0)
        karma_delta = new_contrib - old_contrib
        if karma_delta and comment.user_id != user.id:
            try:
                from users.models import Profile
                profile, _ = Profile.objects.get_or_create(user_id=comment.user_id)
                Profile.objects.filter(pk=profile.pk).update(karma=F('karma') + karma_delta)
            except Exception:
                pass

        boost = CommentVote.objects.filter(
            comment=comment, value=CommentVote.BOOST,
        ).count()
        dim = CommentVote.objects.filter(
            comment=comment, value=CommentVote.DIM,
        ).count()
        return Response({
            'vote_score': boost - dim,
            'boost_count': boost,
            'dim_count': dim,
            'my_vote': my_vote,
        })

    @action(detail=True, methods=['post'])
    def translate(self, request, pk=None):
        """Translate comment text into the viewer's language (cached)."""
        comment = self.get_object()
        lang = (request.data.get('lang') or request.query_params.get('lang') or 'en')
        lang = str(lang).split('-')[0].lower()[:5]
        if lang not in ('en', 'ar'):
            return Response({'error': 'Unsupported language.'}, status=400)
        if not (comment.text or '').strip():
            return Response({'error': 'Nothing to translate.'}, status=400)

        cached = CommentTranslation.objects.filter(
            comment=comment, language=lang,
        ).first()
        if cached:
            return Response({
                'language': lang,
                'text': cached.text,
                'cached': True,
            })

        from .comment_translate import translate_comment_text
        translated = translate_comment_text(comment.text, lang)
        if not translated:
            return Response({'error': 'Translation unavailable.'}, status=503)

        CommentTranslation.objects.update_or_create(
            comment=comment,
            language=lang,
            defaults={'text': translated},
        )
        return Response({
            'language': lang,
            'text': translated,
            'cached': False,
        })

    @action(detail=True, methods=['post'])
    def spark(self, request, pk=None):
        """Host highlights a comment with a creator spark (TikTok-style heart)."""
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.post.user_id != user.id:
            return Response({'error': 'Only the post author can spark.'}, status=403)
        comment.sparked_by_author = not comment.sparked_by_author
        comment.save(update_fields=['sparked_by_author'])
        if comment.sparked_by_author and comment.user_id != user.id:
            create_notification(
                recipient_id=comment.user_id,
                actor_id=user.id,
                verb='reaction',
                post=comment.post,
                text='sparked your comment',
            )
        return Response({'sparked_by_author': comment.sparked_by_author})


class StaffPostModerationView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        posts = (
            Post.objects.select_related('user')
            .order_by('-created_at')[:100]
        )
        payload = PostSerializer(posts, many=True, context={'request': request}).data
        return Response(payload)

    def delete(self, request):
        post_id = request.data.get('post_id')
        if not post_id:
            return Response({'error': 'post_id is required.'}, status=400)
        post = Post.objects.filter(id=post_id).first()
        if not post:
            return Response({'error': 'Post not found.'}, status=404)
        post.delete()
        return Response(status=204)


class StaffCommentModerationView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        post_id = request.query_params.get('post_id')
        qs = Comment.objects.select_related('user', 'post').order_by('-created_at')
        if post_id:
            qs = qs.filter(post_id=post_id)
        serializer = CommentSerializer(qs[:200], many=True, context={'request': request})
        return Response(serializer.data)

    def delete(self, request):
        comment_id = request.data.get('comment_id')
        if not comment_id:
            return Response({'error': 'comment_id is required.'}, status=400)
        comment = Comment.objects.filter(id=comment_id).first()
        if not comment:
            return Response({'error': 'Comment not found.'}, status=404)
        post = comment.post
        comment.delete()
        post.comments_count = post.comments.count()
        post.save(update_fields=['comments_count'])
        return Response(status=204)


class PostDraftViewSet(viewsets.ModelViewSet):
    """Auto-saved post drafts — scoped to the authenticated user.

    ``GET /api/posts/drafts/``
        List the caller's drafts, newest first.

    ``POST /api/posts/drafts/``
        Create a draft. Body: ``{text, mood?, tags?}``.

    ``PATCH /api/posts/drafts/{id}/``
        Update (used by the frontend's debounced auto-save).

    ``DELETE /api/posts/drafts/{id}/``
        Discard a draft. Called automatically after a successful publish.
    """

    serializer_class = PostDraftSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = user_from_request(self.request)
        if not user:
            return PostDraft.objects.none()
        return PostDraft.objects.filter(user=user)

    def perform_create(self, serializer):
        user = user_from_request(self.request)
        if not user:
            return Response({'detail': 'Authentication required.'}, status=401)
        serializer.save(user=user)


class ScheduledPostViewSet(viewsets.ModelViewSet):
    """Posts queued to publish at a future time — scoped to the authenticated
    user. Publishing itself happens out-of-band via the
    ``publish_scheduled_posts`` management command (cron), not through this
    API.

    ``GET /api/scheduled-posts/``
        List the caller's scheduled posts, soonest first.

    ``POST /api/scheduled-posts/``
        Queue one. Body: ``{payload: {text, mood?, tags?, visibility?, required_tier_id?, community_id?}, publish_at}``.

    ``DELETE /api/scheduled-posts/{id}/``
        Cancel — only allowed while still pending.
    """

    serializer_class = ScheduledPostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = user_from_request(self.request)
        if not user:
            return ScheduledPost.objects.none()
        return ScheduledPost.objects.filter(user=user).prefetch_related('media_files')

    def perform_create(self, serializer):
        user = user_from_request(self.request)
        if not user:
            return Response({'detail': 'Authentication required.'}, status=401)
        serializer.save(user=user)

    def destroy(self, request, *args, **kwargs):
        scheduled = self.get_object()
        if scheduled.status != 'pending':
            return Response({'error': 'Only pending scheduled posts can be canceled.'}, status=400)
        scheduled.status = 'canceled'
        scheduled.save(update_fields=['status'])
        return Response(status=204)

    @action(
        detail=True,
        methods=['post'],
        url_path='add_media',
        parser_classes=[MultiPartParser, FormParser],
    )
    def add_media(self, request, pk=None):
        scheduled = self.get_object()
        if scheduled.status != 'pending':
            return Response({'error': 'Only pending scheduled posts can accept media.'}, status=400)
        files = request.FILES.getlist('media')
        if not files:
            return Response({'error': 'media file(s) are required.'}, status=400)
        start = scheduled.media_files.count()
        created = []
        for idx, media_file in enumerate(files):
            content_type = getattr(media_file, 'content_type', '') or ''
            if content_type.startswith('video'):
                media_type = 'video'
            elif content_type.startswith('audio'):
                media_type = 'audio'
            else:
                media_type = 'image'
            created.append(
                ScheduledMedia.objects.create(
                    scheduled_post=scheduled,
                    media_file=media_file,
                    media_type=media_type,
                    order=start + idx,
                )
            )
        return Response(
            ScheduledMediaSerializer(created, many=True, context={'request': request}).data,
            status=201,
        )


class SavedCollectionViewSet(viewsets.ModelViewSet):
    """User-named folders for organizing saved posts.

    ``GET /api/collections/``     List the caller's collections.
    ``POST /api/collections/``    Create ``{name}``.
    ``DELETE /api/collections/{id}/``  Remove a folder (saved posts keep,
    their ``collection`` is set null).
    """

    serializer_class = SavedCollectionSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action == 'public':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = user_from_request(self.request)
        if not user:
            return SavedCollection.objects.none()
        return SavedCollection.objects.filter(user=user)

    def _bool_value(self, value):
        if isinstance(value, bool):
            return value
        return str(value).lower() in ('1', 'true', 'yes', 'on')

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'Name is required.'}, status=400)
        collection, created = SavedCollection.objects.get_or_create(
            user=user,
            name=name,
            defaults={
                'description': request.data.get('description') or '',
                'is_public': self._bool_value(request.data.get('is_public', False)),
                'cover_url': request.data.get('cover_url') or '',
            },
        )
        if not created:
            changed = []
            for field in ('description', 'cover_url'):
                if field in request.data:
                    setattr(collection, field, request.data.get(field) or '')
                    changed.append(field)
            if 'is_public' in request.data:
                collection.is_public = self._bool_value(request.data.get('is_public'))
                changed.append('is_public')
            if changed:
                collection.save(update_fields=changed)
        return Response(self.get_serializer(collection).data, status=201)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def public(self, request, pk=None):
        collection = SavedCollection.objects.filter(pk=pk, is_public=True).select_related('user').first()
        if not collection:
            return Response({'detail': 'Not found.'}, status=404)
        items = (
            SavedPost.objects.filter(collection=collection, post__is_active=True, post__visibility='public')
            .select_related('post', 'post__user')
            .prefetch_related('post__media', 'post__reactions', 'post__poll_options')
            .order_by('-created_at')
        )
        posts = [item.post for item in items if can_view_post(item.post, None)]
        return Response({
            'collection': SavedCollectionSerializer(collection, context={'request': request}).data,
            'items': PostSerializer(posts, many=True, context={'request': request}).data,
        })


class OrbitListViewSet(viewsets.ModelViewSet):
    """Twitter Lists → Orbit Lists: curated member feeds.

    ``GET /api/orbit-lists/`` — own lists (+ optional ``?following=1`` followed public)
    ``POST /api/orbit-lists/`` — create ``{title, description?, is_private?}``
    ``GET /api/orbit-lists/{id}/`` — detail (private lists owner-only)
    ``PATCH/DELETE`` — owner only
    ``POST .../members/`` — ``{user_id}`` add
    ``DELETE .../members/{user_id}/`` — remove
    ``POST .../follow/`` — follow a public list
    ``GET .../feed/`` — chronological posts from members
    """

    serializer_class = OrbitListSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ('retrieve', 'feed'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['viewer'] = user_from_request(self.request)
        return ctx

    def get_queryset(self):
        viewer = user_from_request(self.request)
        qs = OrbitList.objects.select_related('owner').prefetch_related(
            Prefetch(
                'members',
                queryset=OrbitListMember.objects.select_related('user').order_by('-added_at'),
            ),
        )
        if self.action == 'list':
            if not viewer:
                return OrbitList.objects.none()
            following = self.request.query_params.get('following')
            discover = self.request.query_params.get('discover')
            if following in ('1', 'true', 'yes'):
                return qs.filter(
                    followers__user=viewer, is_private=False,
                ).distinct()
            if discover in ('1', 'true', 'yes'):
                return qs.filter(is_private=False).exclude(owner=viewer).annotate(
                    _follower_count=Count('followers', distinct=True),
                ).order_by('-_follower_count', '-created_at')
            return qs.filter(owner=viewer)
        return qs

    def retrieve(self, request, *args, **kwargs):
        orbit = self.get_object()
        viewer = user_from_request(request)
        if orbit.is_private and (not viewer or orbit.owner_id != viewer.id):
            return Response({'error': 'This Orbit List is private.'}, status=403)
        return Response(self.get_serializer(orbit).data)

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        title = (request.data.get('title') or '').strip()
        if not title:
            return Response({'error': 'Title is required.'}, status=400)
        orbit = OrbitList.objects.create(
            owner=user,
            title=title[:80],
            description=(request.data.get('description') or '')[:2000],
            is_private=bool(request.data.get('is_private', False)),
        )
        return Response(self.get_serializer(orbit).data, status=201)

    def update(self, request, *args, **kwargs):
        orbit = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if orbit.owner_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        orbit = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if orbit.owner_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def members(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        orbit = self.get_object()
        if orbit.owner_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        member_id = request.data.get('user_id') or request.data.get('user')
        if not member_id:
            return Response({'error': 'user_id is required.'}, status=400)
        member = User.objects.filter(pk=member_id).first()
        if not member:
            return Response({'error': 'User not found.'}, status=404)
        if member.id == user.id:
            return Response({'error': 'Add others to your Orbit List.'}, status=400)
        row, created = OrbitListMember.objects.get_or_create(
            orbit_list=orbit, user=member,
        )
        orbit.updated_at = timezone.now()
        orbit.save(update_fields=['updated_at'])
        return Response(
            OrbitListSerializer(orbit, context=self.get_serializer_context()).data,
            status=201 if created else 200,
        )

    @action(detail=True, methods=['delete'], url_path=r'members/(?P<user_id>[^/.]+)')
    def remove_member(self, request, pk=None, user_id=None):
        user, err = require_user(request)
        if err:
            return err
        orbit = self.get_object()
        if orbit.owner_id != user.id:
            return Response({'error': 'Not allowed.'}, status=403)
        deleted, _ = OrbitListMember.objects.filter(
            orbit_list=orbit, user_id=user_id,
        ).delete()
        if not deleted:
            return Response({'error': 'Member not found.'}, status=404)
        return Response(status=204)

    @action(detail=True, methods=['post'])
    def follow(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        orbit = self.get_object()
        if orbit.owner_id == user.id:
            return Response({'error': 'You already own this list.'}, status=400)
        if orbit.is_private:
            return Response({'error': 'Cannot follow a private Orbit List.'}, status=403)
        existing = OrbitListFollower.objects.filter(orbit_list=orbit, user=user).first()
        if existing:
            existing.delete()
            return Response({'following': False})
        OrbitListFollower.objects.create(orbit_list=orbit, user=user)
        return Response({'following': True})

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def feed(self, request, pk=None):
        orbit = self.get_object()
        viewer = user_from_request(request)
        if orbit.is_private and (not viewer or orbit.owner_id != viewer.id):
            return Response({'error': 'This Orbit List is private.'}, status=403)
        member_ids = list(
            OrbitListMember.objects.filter(orbit_list=orbit).values_list('user_id', flat=True)
        )
        qs = (
            Post.objects.filter(
                user_id__in=member_ids,
                is_active=True,
                thread_root__isnull=True,
                visibility='public',
            )
            .select_related('user', 'community', 'shared_reel')
            .prefetch_related('media', 'reactions')
            .order_by('-created_at')
        )
        if viewer:
            qs = _apply_feed_social_filters(qs, viewer)
        try:
            limit = int(request.query_params.get('limit') or 20)
        except (TypeError, ValueError):
            limit = 20
        limit = max(1, min(limit, 50))
        try:
            offset = int(request.query_params.get('offset') or 0)
        except (TypeError, ValueError):
            offset = 0
        offset = max(0, offset)
        page = list(qs[offset:offset + limit])
        data = PostSerializer(page, many=True, context={'request': request}).data
        return Response({
            'results': data,
            'count': qs.count(),
            'has_more': offset + limit < qs.count(),
            'orbit_list_id': orbit.id,
        })
