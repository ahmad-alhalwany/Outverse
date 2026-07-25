from collections import Counter

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import (
    Case, Count, ExpressionWrapper, F, FloatField, IntegerField, Q, Sum, When,
)
from django.db.models.functions import Coalesce, Greatest, Least
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from notifications.utils import create_notification
from outverse.auth_utils import require_user, user_from_request
from users.models import Follow
from users.privacy import can_comment, text_has_hidden_word
from users.social import feed_hidden_author_ids, is_blocked_between, restricted_user_ids

from .models import (
    Reel, ReelComment, ReelCommentReaction, ReelCommentTranslation, ReelCommentVote,
    ReelDim, ReelDraft, ReelLike, ReelMusicTrack, ReelTemplate, SavedReel,
)


def _reel_subscriber_gate_q(viewer):
    """Q clause matching subscriber-only reels the viewer has paid access
    to — mirrors posts._subscriber_gate_q (see that function for the
    tier-comparison rationale)."""
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


def can_view_reel(reel, viewer):
    if reel.visibility != 'subscribers':
        return True
    if viewer and viewer.id == reel.user_id:
        return True
    if not viewer:
        return False
    from subscriptions.models import CreatorSubscription

    sub = CreatorSubscription.objects.filter(
        fan_id=viewer.id, creator_id=reel.user_id, status='active',
    ).select_related('tier').first()
    if not sub:
        return False
    if reel.required_tier_id and sub.tier.price_usd_cents < reel.required_tier.price_usd_cents:
        return False
    return True
from .serializers import (
    ReelCommentSerializer,
    ReelDraftSerializer,
    ReelMusicTrackSerializer,
    ReelSerializer,
    ReelTemplateSerializer,
    UserSerializer,
    reaction_counts_for_comment,
    reaction_counts_for_reel,
)

REEL_REACTION_TYPES = {r[0] for r in ReelLike.REACTION_TYPES}
from .utils import notify_mentions

VALID_REACTIONS = {r[0] for r in ReelCommentReaction.REACTION_TYPES}


class ReelMusicTrackViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ReelMusicTrack.objects.filter(is_active=True)
    serializer_class = ReelMusicTrackSerializer
    permission_classes = [AllowAny]


class ReelTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ReelTemplate.objects.filter(is_active=True)
    serializer_class = ReelTemplateSerializer
    permission_classes = [AllowAny]


class ReelCommentViewSet(viewsets.ModelViewSet):
    serializer_class = ReelCommentSerializer
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.action in (
            'create', 'update', 'partial_update', 'destroy',
            'react', 'pin', 'spark', 'vote', 'translate',
        ):
            return [IsAuthenticated()]
        return [AllowAny()]

    COMMENT_SORTS = {'best', 'top', 'new', 'old', 'controversial'}

    def _vote_score_annotation(self):
        return Coalesce(
            Sum(Case(
                When(votes__value=ReelCommentVote.BOOST, then=1),
                When(votes__value=ReelCommentVote.DIM, then=-1),
                default=0,
                output_field=IntegerField(),
            )),
            0,
        )

    def _boost_count_annotation(self):
        return Coalesce(
            Sum(Case(
                When(votes__value=ReelCommentVote.BOOST, then=1),
                default=0,
                output_field=IntegerField(),
            )),
            0,
        )

    def _dim_count_annotation(self):
        return Coalesce(
            Sum(Case(
                When(votes__value=ReelCommentVote.DIM, then=1),
                default=0,
                output_field=IntegerField(),
            )),
            0,
        )

    def get_queryset(self):
        qs = ReelComment.objects.select_related(
            'user', 'reel', 'quoted_comment',
        ).prefetch_related('reactions', 'votes')
        reel_id = self.request.query_params.get('reel')
        if reel_id:
            qs = qs.filter(reel_id=reel_id)
        viewer = user_from_request(self.request)
        if self.action == 'list' and reel_id:
            reel = Reel.objects.filter(pk=reel_id).first()
            if reel:
                # Restrict (IG-style): the reel owner still sees every
                # comment (to moderate); everyone else — including the
                # restricted author seeing their own comment — has
                # comments from the owner's restricted list hidden, except
                # a viewer's own comments always stay visible to them.
                owner_restricted = restricted_user_ids(reel.user_id)
                if owner_restricted and not (viewer and viewer.id == reel.user_id):
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
            limit = int(request.query_params.get('limit', 30))
        except (TypeError, ValueError):
            limit = 30
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

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        reel_id = request.data.get('reel')
        if not reel_id:
            return Response({'detail': 'reel is required.'}, status=400)
        parent_id = request.data.get('parent')
        reel = Reel.objects.filter(pk=reel_id).first()
        if not reel:
            return Response({'detail': 'Reel not found.'}, status=404)
        if parent_id:
            parent = ReelComment.objects.filter(pk=parent_id, reel_id=reel_id).first()
            if not parent:
                return Response({'detail': 'Invalid parent comment.'}, status=400)
        if is_blocked_between(user.id, reel.user_id):
            return Response({'detail': 'Cannot comment on this signal.'}, status=403)
        if not can_comment(user, reel.user):
            return Response({'detail': 'Comments are restricted on this signal.'}, status=403)
        from preferences.models import UserPreferences
        author_prefs, _ = UserPreferences.objects.get_or_create(user=reel.user)
        comment_text = request.data.get('text') or ''
        if text_has_hidden_word(comment_text, author_prefs.hidden_words or []):
            return Response({'detail': 'Comment contains blocked words.'}, status=400)
        response = super().create(request, *args, **kwargs)
        if response.status_code == 201:
            Reel.objects.filter(pk=reel_id).update(
                comments_count=F('comments_count') + 1
            )
            try:
                from moderation.hooks import enforce_moderation_result, soft_moderate_content
                result = soft_moderate_content(
                    text=comment_text,
                    content_type='reel_comment',
                    object_id=response.data.get('id'),
                    user=user,
                )
                if result.get('hard_block'):
                    enforce_moderation_result(
                        result,
                        content_type='reel_comment',
                        object_id=response.data.get('id'),
                    )
            except Exception:
                pass
            parent = None
            if parent_id:
                parent = ReelComment.objects.filter(pk=parent_id).select_related('user').first()
            recipient_id = parent.user_id if parent else reel.user_id
            verb_text = (
                'replied on your signal'
                if parent_id
                else 'commented on your signal'
            )
            create_notification(
                recipient_id=recipient_id,
                actor_id=user.id,
                verb='comment',
                reel=reel,
                text=verb_text,
            )
            notify_mentions(request.data.get('text', ''), user, reel, 'mentioned you in a comment')
            try:
                from notifications.realtime import push_reel_comment
                comment = ReelComment.objects.filter(pk=response.data.get('id')).first()
                if comment:
                    push_reel_comment(reel_id, {
                        'action': 'created',
                        'comment_id': comment.id,
                        'comment': ReelCommentSerializer(
                            comment, context=self.get_serializer_context(),
                        ).data,
                    })
            except Exception:
                pass
        return response

    def _sync_reel_comment_count(self, reel_id):
        total = ReelComment.objects.filter(reel_id=reel_id).count()
        Reel.objects.filter(pk=reel_id).update(comments_count=total)

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.user_id != user.id:
            return Response({'detail': 'Not allowed.'}, status=403)
        response = super().update(request, *args, **kwargs)
        if response.status_code == 200 and 'text' in request.data:
            comment.edited_at = timezone.now()
            comment.save(update_fields=['edited_at'])
        return response

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.user_id != user.id:
            return Response({'detail': 'Not allowed.'}, status=403)
        reel_id = comment.reel_id
        response = super().destroy(request, *args, **kwargs)
        self._sync_reel_comment_count(reel_id)
        return response

    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        rtype = request.data.get('reaction')
        if rtype is not None and rtype not in VALID_REACTIONS:
            return Response({'detail': 'Invalid reaction.'}, status=400)

        existing = ReelCommentReaction.objects.filter(
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
            ReelCommentReaction.objects.create(
                comment=comment, user=user, type=rtype
            )
            my_reaction = rtype
            create_notification(
                recipient_id=comment.user_id,
                actor_id=user.id,
                verb='reaction',
                reel=comment.reel,
                text='reacted to your echo on a signal',
            )

        return Response({
            'reaction_counts': reaction_counts_for_comment(comment),
            'my_reaction': my_reaction,
        })

    @action(detail=True, methods=['post'])
    def pin(self, request, pk=None):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.reel.user_id != user.id:
            return Response({'detail': 'Only the reel owner can pin comments.'}, status=403)
        if comment.parent_id is not None:
            return Response({'detail': 'Only top-level comments can be pinned.'}, status=400)

        with transaction.atomic():
            if comment.pin_order:
                removed = comment.pin_order
                comment.pin_order = None
                comment.save(update_fields=['pin_order'])
                ReelComment.objects.filter(
                    reel_id=comment.reel_id, pin_order__gt=removed,
                ).update(pin_order=F('pin_order') - 1)
            else:
                pinned = ReelComment.objects.filter(
                    reel_id=comment.reel_id, pin_order__isnull=False,
                ).count()
                if pinned >= ReelComment.MAX_PINNED:
                    return Response(
                        {'detail': f'Max {ReelComment.MAX_PINNED} anchored comments.'},
                        status=400,
                    )
                comment.pin_order = pinned + 1
                comment.save(update_fields=['pin_order'])

        return Response({
            'pin_order': comment.pin_order,
            'is_pinned': comment.pin_order is not None,
        })

    @action(detail=True, methods=['post'])
    def spark(self, request, pk=None):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.reel.user_id != user.id:
            return Response({'detail': 'Only the reel owner can spark.'}, status=403)
        comment.sparked_by_author = not comment.sparked_by_author
        comment.save(update_fields=['sparked_by_author'])
        if comment.sparked_by_author and comment.user_id != user.id:
            create_notification(
                recipient_id=comment.user_id,
                actor_id=user.id,
                verb='reaction',
                reel=comment.reel,
                text='sparked your echo on a signal',
            )
        return Response({'sparked_by_author': comment.sparked_by_author})

    @action(detail=True, methods=['post'])
    def vote(self, request, pk=None):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        vote = request.data.get('vote')
        if vote not in ('boost', 'dim', None, ''):
            return Response({'detail': 'Invalid vote.'}, status=400)

        existing = ReelCommentVote.objects.filter(comment=comment, user=user).first()
        my_vote = None
        if not vote:
            if existing:
                existing.delete()
        else:
            value = ReelCommentVote.BOOST if vote == 'boost' else ReelCommentVote.DIM
            if existing:
                if existing.value == value:
                    existing.delete()
                else:
                    existing.value = value
                    existing.save(update_fields=['value'])
                    my_vote = vote
            else:
                ReelCommentVote.objects.create(comment=comment, user=user, value=value)
                my_vote = vote

        boost = ReelCommentVote.objects.filter(
            comment=comment, value=ReelCommentVote.BOOST,
        ).count()
        dim = ReelCommentVote.objects.filter(
            comment=comment, value=ReelCommentVote.DIM,
        ).count()
        return Response({
            'vote_score': boost - dim,
            'boost_count': boost,
            'dim_count': dim,
            'my_vote': my_vote,
        })

    @action(detail=True, methods=['post'])
    def translate(self, request, pk=None):
        comment = self.get_object()
        lang = (request.data.get('lang') or request.query_params.get('lang') or 'en')
        lang = str(lang).split('-')[0].lower()[:5]
        if lang not in ('en', 'ar'):
            return Response({'detail': 'Unsupported language.'}, status=400)
        if not (comment.text or '').strip():
            return Response({'detail': 'Nothing to translate.'}, status=400)

        cached = ReelCommentTranslation.objects.filter(
            comment=comment, language=lang,
        ).first()
        if cached:
            return Response({'language': lang, 'text': cached.text, 'cached': True})

        from posts.comment_translate import translate_comment_text
        translated = translate_comment_text(comment.text, lang)
        if not translated:
            return Response({'detail': 'Translation unavailable.'}, status=503)

        ReelCommentTranslation.objects.update_or_create(
            comment=comment, language=lang, defaults={'text': translated},
        )
        return Response({'language': lang, 'text': translated, 'cached': False})


class ReelDiscoverView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cached = cache.get('reels:discover')
        if cached is not None:
            return Response(cached)
        base = Reel.objects.filter(is_active=True).select_related(
            'user', 'music_track'
        )
        ctx = {'request': request}
        viewer = user_from_request(request)
        if viewer:
            ctx['liked_ids'] = set(
                ReelLike.objects.filter(user=viewer).values_list('reel_id', flat=True)
            )
            dimmed_ids = list(
                ReelDim.objects.filter(user=viewer).values_list('reel_id', flat=True)
            )
            if dimmed_ids:
                base = base.exclude(id__in=dimmed_ids)
            ctx['dimmed_ids'] = set(dimmed_ids)

        trending = base.order_by('-views', '-likes_count')[:12]
        featured = base.filter(is_featured=True).order_by('-created_at')[:8]
        if not featured.exists():
            featured = base.order_by('-likes_count')[:8]

        fresh = base.order_by('-created_at')[:12]

        by_mood = {}
        for mood_key, _ in Reel.MOOD_CHOICES:
            by_mood[mood_key] = ReelSerializer(
                base.filter(mood=mood_key).order_by('-created_at')[:6],
                many=True,
                context=ctx,
            ).data

        tag_counter = Counter()
        for tags in base.values_list('tags', flat=True)[:200]:
            if isinstance(tags, list):
                for t in tags:
                    if t:
                        tag_counter[str(t).lower()] += 1
        top_tags = [t for t, _ in tag_counter.most_common(12)]

        by_tag = {}
        for tag in top_tags[:6]:
            by_tag[tag] = ReelSerializer(
                base.filter(tags__contains=[tag]).order_by('-created_at')[:6],
                many=True,
                context=ctx,
            ).data

        payload = {
            'trending': ReelSerializer(trending, many=True, context=ctx).data,
            'featured': ReelSerializer(featured, many=True, context=ctx).data,
            'fresh': ReelSerializer(fresh, many=True, context=ctx).data,
            'by_mood': by_mood,
            'top_tags': top_tags,
            'by_tag': by_tag,
        }
        cache.set('reels:discover', payload, 180)
        return Response(payload)


class ReelDraftViewSet(viewsets.ModelViewSet):
    """Auto-saved reel drafts — metadata only; video is chosen again on publish."""

    serializer_class = ReelDraftSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = user_from_request(self.request)
        if not user:
            return ReelDraft.objects.none()
        return ReelDraft.objects.filter(user=user).select_related('music_track')

    def perform_create(self, serializer):
        user = user_from_request(self.request)
        serializer.save(user=user)


class ReelViewSet(viewsets.ModelViewSet):
    queryset = Reel.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = ReelSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in (
            'list', 'retrieve', 'record_view', 'discover', 'reactors',
        ):
            return [AllowAny()]
        if self.action in ('react', 'remix_meaning', 'generate_captions', 'dwell', 'dim', 'save'):
            return [IsAuthenticated()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        viewer = user_from_request(self.request)
        if viewer:
            ctx['liked_ids'] = set(
                ReelLike.objects.filter(user=viewer).values_list('reel_id', flat=True)
            )
            ctx['saved_ids'] = set(
                SavedReel.objects.filter(user=viewer).values_list('reel_id', flat=True)
            )
            ctx['dimmed_ids'] = set(
                ReelDim.objects.filter(user=viewer).values_list('reel_id', flat=True)
            )
        return ctx

    def get_queryset(self):
        viewer = user_from_request(self.request)
        if viewer and viewer.is_staff and self.request.query_params.get('admin') == '1':
            qs = Reel.objects.all().select_related('user', 'music_track', 'template')
        else:
            qs = Reel.objects.filter(is_active=True).select_related(
                'user', 'music_track', 'template'
            )
        qs = qs.order_by('-created_at')
        if self.action != 'list':
            return qs
        mood = self.request.query_params.get('mood')
        tag = self.request.query_params.get('tag')
        filter_style = self.request.query_params.get('filter')
        music_track = self.request.query_params.get('music_track')
        if mood:
            qs = qs.filter(mood=mood)
        if tag:
            qs = qs.filter(tags__contains=[tag])
        if filter_style:
            qs = qs.filter(filter_style=filter_style)
        if music_track:
            qs = qs.filter(music_track_id=music_track)
        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)
        viewer = user_from_request(self.request)
        if self.request.query_params.get('feed') == 'following' and viewer:
            following_ids = Follow.objects.filter(
                follower=viewer
            ).values_list('following_id', flat=True)
            qs = qs.filter(user_id__in=following_ids)
        if viewer and self.action == 'list':
            hidden = feed_hidden_author_ids(viewer.id)
            if hidden:
                qs = qs.exclude(user_id__in=hidden)
            dimmed_ids = ReelDim.objects.filter(user=viewer).values_list('reel_id', flat=True)
            qs = qs.exclude(id__in=dimmed_ids)
        # Audience control: hide subscriber-only reels from non-subscribers.
        if viewer:
            qs = qs.filter(
                Q(visibility='public') | Q(user_id=viewer.id) | _reel_subscriber_gate_q(viewer)
            )
        else:
            qs = qs.filter(visibility='public')
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        feed = (request.query_params.get('feed') or 'pulse').lower()
        try:
            limit = int(request.query_params.get('limit', 20))
        except (TypeError, ValueError):
            limit = 20
        limit = max(1, min(limit, 40))
        try:
            offset = int(request.query_params.get('offset', 0))
        except (TypeError, ValueError):
            offset = 0
        offset = max(0, offset)

        # Pulse = ranked For You. Orbit/following & user filters stay chronological.
        use_pulse = feed in ('pulse', 'all', 'for_you', '') and not request.query_params.get('user')
        if use_pulse and feed != 'following':
            from .pulse_ranker import rank_pulse_reels
            ranked = rank_pulse_reels(qs, user_from_request(request), limit=offset + limit)
            page = ranked[offset:offset + limit]
            data = self.get_serializer(page, many=True).data
            return Response({
                'results': data,
                'count': len(ranked),
                'has_more': offset + limit < len(ranked),
                'ranking': 'pulse',
            })

        count = qs.count()
        page = list(qs[offset:offset + limit])
        data = self.get_serializer(page, many=True).data
        return Response({
            'results': data,
            'count': count,
            'has_more': offset + limit < count,
            'ranking': 'chrono',
        })

    def retrieve(self, request, *args, **kwargs):
        reel = self.get_object()
        if not can_view_reel(reel, user_from_request(request)):
            return Response({'error': 'This signal is limited to subscribers.'}, status=403)
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        response = super().create(request, *args, **kwargs)
        if response.status_code == 201:
            reel = Reel.objects.filter(pk=response.data.get('id')).first()
            if reel:
                notify_mentions(reel.caption, user, reel, 'mentioned you in a signal')
                try:
                    from moderation.hooks import enforce_moderation_result, soft_moderate_content
                    result = soft_moderate_content(
                        text=reel.caption or '',
                        content_type='reel',
                        object_id=reel.id,
                        user=user,
                    )
                    if result.get('hard_block'):
                        enforce_moderation_result(
                            result,
                            content_type='reel',
                            object_id=reel.id,
                        )
                except Exception:
                    pass
        return response

    def destroy(self, request, *args, **kwargs):
        reel = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if reel.user_id != user.id and not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        reel = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if reel.user_id != user.id and not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        return super().partial_update(request, *args, **kwargs)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def discover(self, request):
        return ReelDiscoverView().get(request)

    @action(detail=False, methods=['post'], url_path='remix-meaning', permission_classes=[IsAuthenticated])
    def remix_meaning(self, request):
        """Suggest hook + caption + meaning for a remix from an idea/question."""
        user, err = require_user(request)
        if err:
            return err
        from outverse.ai_coaches import remix_meaning as _remix
        lang = (request.data.get('lang') or 'en')[:2]
        return Response(_remix(
            source_label=request.data.get('source_label') or '',
            source_text=request.data.get('source_text') or '',
            draft_caption=request.data.get('draft_caption') or '',
            language=lang if lang in ('en', 'ar') else 'en',
        ))

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def record_view(self, request, pk=None):
        reel = self.get_object()
        reel.views = F('views') + 1
        reel.save(update_fields=['views'])
        reel.refresh_from_db()
        viewer = user_from_request(request)
        if viewer:
            _cache_key = f'reel:view_event:{reel.pk}:{viewer.pk}'
            if not cache.get(_cache_key):
                cache.set(_cache_key, 1, timeout=300)
                try:
                    from analytics.models import ContentEngagementEvent
                    ContentEngagementEvent.objects.create(
                        user=viewer,
                        content_type='reel',
                        content_id=reel.pk,
                        author_id=reel.user_id,
                        event_type='view',
                    )
                except Exception:
                    pass
        return Response({'views': reel.views})

    record_view.throttle_classes = [AnonRateThrottle]

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def share(self, request, pk=None):
        from .models import ReelShareLog

        reel = self.get_object()
        raw_channel = (request.data.get('channel') or 'unknown').lower()
        valid = {c for c, _ in ReelShareLog.CHANNEL_CHOICES}
        channel = raw_channel if raw_channel in valid else 'unknown'
        user = user_from_request(request)

        reel.shares_count = F('shares_count') + 1
        reel.save(update_fields=['shares_count'])
        reel.refresh_from_db()
        ReelShareLog.objects.create(reel=reel, user=user, channel=channel)

        if user and user.id != reel.user_id:
            first_share = ReelShareLog.objects.filter(reel=reel, user=user).count() == 1
            if first_share:
                create_notification(
                    recipient_id=reel.user_id,
                    actor_id=user.id,
                    verb='share',
                    reel=reel,
                    text='transmitted your signal',
                )
        return Response({'shares_count': reel.shares_count, 'channel': channel})

    share.throttle_classes = [AnonRateThrottle]

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def react(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        reel = self.get_object()
        rtype = request.data.get('reaction') or 'spark'
        if rtype not in REEL_REACTION_TYPES:
            return Response({'error': 'Invalid reaction.'}, status=400)

        existing = ReelLike.objects.filter(user=user, reel=reel).first()
        if existing and existing.type == rtype:
            existing.delete()
            my_reaction = None
            Reel.objects.filter(pk=reel.pk).update(likes_count=F('likes_count') - 1)
        elif existing:
            existing.type = rtype
            existing.save(update_fields=['type'])
            my_reaction = rtype
        else:
            ReelLike.objects.create(user=user, reel=reel, type=rtype)
            my_reaction = rtype
            Reel.objects.filter(pk=reel.pk).update(likes_count=F('likes_count') + 1)
            create_notification(
                recipient_id=reel.user_id,
                actor_id=user.id,
                verb='reaction',
                reel=reel,
                text='resonated with your signal',
            )
            try:
                from analytics.models import ContentEngagementEvent
                ContentEngagementEvent.objects.create(
                    user=user,
                    content_type='reel',
                    content_id=reel.pk,
                    author_id=reel.user_id,
                    event_type='like',
                )
            except Exception:
                pass

        reel.refresh_from_db(fields=['likes_count'])
        return Response({
            'liked': my_reaction is not None,
            'likes_count': reel.likes_count,
            'reaction_counts': reaction_counts_for_reel(reel),
            'my_reaction': my_reaction,
            'total': reel.likes_count,
        })

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def reactors(self, request, pk=None):
        reel = self.get_object()
        rtype = request.query_params.get('type')
        qs = ReelLike.objects.filter(reel=reel).select_related('user').order_by('-created_at')
        if rtype in REEL_REACTION_TYPES:
            qs = qs.filter(type=rtype)
        try:
            limit = min(int(request.query_params.get('limit', 40)), 80)
        except (TypeError, ValueError):
            limit = 40
        rows = [
            {
                'user': UserSerializer(like.user).data,
                'type': like.type,
                'created_at': like.created_at.isoformat(),
            }
            for like in qs[:limit]
        ]
        return Response({
            'results': rows,
            'count': qs.count(),
            'reaction_counts': reaction_counts_for_reel(reel),
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def save(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        reel = self.get_object()
        existing = SavedReel.objects.filter(user=user, reel=reel).first()
        if existing:
            existing.delete()
            saved = False
        else:
            SavedReel.objects.get_or_create(user=user, reel=reel)
            saved = True
        return Response({'saved': saved})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def dim(self, request, pk=None):
        """Hide this signal from the viewer's Pulse (TikTok-style Not interested)."""
        user, err = require_user(request)
        if err:
            return err
        reel = self.get_object()
        if reel.user_id == user.id:
            return Response({'detail': 'Cannot dim your own signal.'}, status=400)
        existing = ReelDim.objects.filter(user=user, reel=reel).first()
        if existing:
            existing.delete()
            dimmed = False
        else:
            ReelDim.objects.get_or_create(user=user, reel=reel)
            dimmed = True
            try:
                from analytics.models import ContentEngagementEvent
                ContentEngagementEvent.objects.create(
                    user=user,
                    content_type='reel',
                    content_id=reel.pk,
                    author_id=reel.user_id,
                    event_type='hide',
                )
            except Exception:
                pass
        return Response({'dimmed': dimmed})

    @action(detail=True, methods=['post'], url_path='generate-captions', permission_classes=[IsAuthenticated])
    def generate_captions(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        reel = self.get_object()
        if reel.user_id != user.id and not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        from .captions import generate_captions_for_reel
        lang = (request.data.get('language') or request.data.get('lang') or reel.captions_language or 'en')[:8]
        force = bool(request.data.get('force'))
        result = generate_captions_for_reel(reel, language=lang, force=force)
        return Response(result)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def dwell(self, request, pk=None):
        """Record watch dwell for Pulse ranking (3s / 10s)."""
        user, err = require_user(request)
        if err:
            return err
        reel = self.get_object()
        seconds = float(request.data.get('seconds') or 0)
        event_type = 'dwell_10s' if seconds >= 10 else 'dwell_3s' if seconds >= 3 else None
        if not event_type:
            return Response({'ok': True, 'recorded': False})
        cache_key = f'reel:dwell:{event_type}:{reel.pk}:{user.pk}'
        if cache.get(cache_key):
            return Response({'ok': True, 'recorded': False})
        cache.set(cache_key, 1, timeout=600)
        try:
            from analytics.models import ContentEngagementEvent
            ContentEngagementEvent.objects.create(
                user=user,
                content_type='reel',
                content_id=reel.pk,
                author_id=reel.user_id,
                event_type=event_type,
                metadata={'seconds': seconds},
            )
        except Exception:
            pass
        return Response({'ok': True, 'recorded': True, 'event_type': event_type})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def saved(self, request):
        user, err = require_user(request)
        if err:
            return err
        qs = Reel.objects.filter(saved_by__user=user, is_active=True).select_related('user', 'music_track').order_by('-saved_by__created_at')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_stats(self, request):
        """Creator-facing signal analytics for the authenticated user."""
        user, err = require_user(request)
        if err:
            return err
        qs = Reel.objects.filter(user=user, is_active=True)
        totals = qs.aggregate(
            total_views=Sum('views'),
            total_likes=Sum('likes_count'),
            total_comments=Sum('comments_count'),
            total_shares=Sum('shares_count'),
        )
        top = qs.order_by('-views')[:5]
        return Response({
            'total_signals': qs.count(),
            'total_views': totals['total_views'] or 0,
            'total_likes': totals['total_likes'] or 0,
            'total_comments': totals['total_comments'] or 0,
            'total_shares': totals['total_shares'] or 0,
            'top_signals': ReelSerializer(
                top, many=True, context=self.get_serializer_context(),
            ).data,
        })
