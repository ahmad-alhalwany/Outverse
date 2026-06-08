from collections import Counter

from django.db.models import F, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.utils import create_notification
from outverse.auth_utils import require_user, user_from_request
from users.models import Follow

from .models import Reel, ReelComment, ReelCommentReaction, ReelLike, ReelMusicTrack
from .serializers import (
    ReelCommentSerializer,
    ReelMusicTrackSerializer,
    ReelSerializer,
    reaction_counts_for_comment,
)

VALID_REACTIONS = {r[0] for r in ReelCommentReaction.REACTION_TYPES}


class ReelMusicTrackViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ReelMusicTrack.objects.filter(is_active=True)
    serializer_class = ReelMusicTrackSerializer
    permission_classes = [AllowAny]


class ReelCommentViewSet(viewsets.ModelViewSet):
    serializer_class = ReelCommentSerializer
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'react'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        qs = ReelComment.objects.select_related('user').prefetch_related('reactions')
        reel_id = self.request.query_params.get('reel')
        if self.action == 'list':
            qs = qs.filter(parent__isnull=True)
            if reel_id:
                qs = qs.filter(reel_id=reel_id)
            return qs.prefetch_related(
                'replies', 'replies__user', 'replies__reactions',
            )
        if reel_id:
            qs = qs.filter(reel_id=reel_id)
        return qs

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
        response = super().create(request, *args, **kwargs)
        if response.status_code == 201:
            Reel.objects.filter(pk=reel_id).update(
                comments_count=F('comments_count') + 1
            )
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
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        comment = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if comment.user_id != user.id:
            return Response({'detail': 'Not allowed.'}, status=403)
        return super().partial_update(request, *args, **kwargs)

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

        return Response({
            'reaction_counts': reaction_counts_for_comment(comment),
            'my_reaction': my_reaction,
        })


class ReelDiscoverView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        base = Reel.objects.filter(is_active=True).select_related(
            'user', 'music_track'
        )
        ctx = {'request': request}
        viewer = user_from_request(request)
        if viewer:
            ctx['liked_ids'] = set(
                ReelLike.objects.filter(user=viewer).values_list('reel_id', flat=True)
            )

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

        return Response({
            'trending': ReelSerializer(trending, many=True, context=ctx).data,
            'featured': ReelSerializer(featured, many=True, context=ctx).data,
            'fresh': ReelSerializer(fresh, many=True, context=ctx).data,
            'by_mood': by_mood,
            'top_tags': top_tags,
            'by_tag': by_tag,
        })


class ReelViewSet(viewsets.ModelViewSet):
    queryset = Reel.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = ReelSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in (
            'list', 'retrieve', 'record_view', 'discover',
        ):
            return [AllowAny()]
        if self.action == 'react':
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
        return ctx

    def get_queryset(self):
        qs = Reel.objects.filter(is_active=True).select_related(
            'user', 'music_track'
        ).order_by('-created_at')
        if self.action != 'list':
            return qs
        feed = self.request.query_params.get('feed')
        mood = self.request.query_params.get('mood')
        tag = self.request.query_params.get('tag')
        filter_style = self.request.query_params.get('filter')
        if mood:
            qs = qs.filter(mood=mood)
        if tag:
            qs = qs.filter(tags__contains=[tag])
        if filter_style:
            qs = qs.filter(filter_style=filter_style)
        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)
        viewer = user_from_request(self.request)
        if self.request.query_params.get('feed') == 'following' and viewer:
            following_ids = Follow.objects.filter(
                follower=viewer
            ).values_list('following_id', flat=True)
            return qs.filter(user_id__in=following_ids)
        return qs

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        reel = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if reel.user_id != user.id:
            return Response({'detail': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def discover(self, request):
        return ReelDiscoverView().get(request)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def record_view(self, request, pk=None):
        reel = self.get_object()
        reel.views = F('views') + 1
        reel.save(update_fields=['views'])
        reel.refresh_from_db()
        return Response({'views': reel.views})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def react(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        reel = self.get_object()
        like, created = ReelLike.objects.get_or_create(user=user, reel=reel)
        if not created:
            like.delete()
            Reel.objects.filter(pk=reel.pk).update(
                likes_count=F('likes_count') - 1
            )
            reel.refresh_from_db()
            liked = False
        else:
            Reel.objects.filter(pk=reel.pk).update(
                likes_count=F('likes_count') + 1
            )
            reel.refresh_from_db()
            liked = True
            create_notification(
                recipient_id=reel.user_id,
                actor_id=user.id,
                verb='reaction',
                reel=reel,
                text='liked your signal',
            )
        return Response({
            'liked': liked,
            'likes_count': reel.likes_count,
        })
