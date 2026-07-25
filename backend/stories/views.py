from django.db import transaction
from django.db.models import Count, F, Q, Case, IntegerField, When
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from notifications.utils import create_notification
from outverse.auth_utils import require_user, user_from_request
from users.models import User

from .models import (
    MOOD_LABELS,
    CloseFriend,
    SavedStory,
    Story,
    StoryConstellation,
    StoryHighlight,
    StoryPollVote,
    StoryQuestionResponse,
    StoryReaction,
    StoryReply,
    StorySpotlight,
    StoryView,
)
from .serializers import (
    StoryConstellationSerializer,
    StoryQuestionResponseSerializer,
    StoryReplySerializer,
    StorySerializer,
    StoryViewerSerializer,
    UserSerializer,
    reaction_counts_for,
)

VALID_REACTIONS = {r[0] for r in StoryReaction.REACTION_TYPES}


class StoryViewSet(viewsets.ModelViewSet):
    serializer_class = StorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in (
            'create', 'update', 'partial_update', 'destroy',
            'view', 'increment_views', 'viewers', 'react',
            'poll_vote', 'question_response', 'question_responses',
            'reply', 'replies', 'archive', 'submit_spotlight',
            'feature_spotlight', 'reject_spotlight',
        ):
            return [IsAuthenticated()]
        if self.action == 'reactors':
            return [AllowAny()]
        return [AllowAny()]

    def get_queryset(self):
        qs = Story.objects.filter(is_active=True, expires_at__gt=timezone.now()).select_related('user')
        viewer = user_from_request(self.request)
        if viewer:
            close_friend_owner_ids = CloseFriend.objects.filter(friend=viewer).values_list('owner_id', flat=True)
            qs = qs.filter(
                Q(audience='everyone') | Q(user_id=viewer.id) | Q(audience='close_friends', user_id__in=close_friend_owner_ids)
            )
        else:
            qs = qs.filter(audience='everyone')
        return qs.order_by('-created_at')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        viewer = user_from_request(self.request)
        if viewer:
            ctx['viewed_ids'] = set(
                StoryView.objects.filter(viewer=viewer).values_list('story_id', flat=True)
            )
            ctx['saved_ids'] = set(
                SavedStory.objects.filter(user=viewer).values_list('story_id', flat=True)
            )
        return ctx

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        response = super().create(request, *args, **kwargs)
        if response.status_code == 201:
            try:
                from moderation.hooks import enforce_moderation_result, soft_moderate_content
                result = soft_moderate_content(
                    text=request.data.get('text') or '',
                    content_type='story',
                    object_id=response.data.get('id'),
                    user=user,
                )
                if result.get('hard_block'):
                    enforce_moderation_result(
                        result,
                        content_type='story',
                        object_id=response.data.get('id'),
                    )
            except Exception:
                pass
        return response

    def destroy(self, request, *args, **kwargs):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if story.user_id != user.id and not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    def _record_view(self, request, pk):
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        _, created = StoryView.objects.get_or_create(story=story, viewer=user)
        if created:
            Story.objects.filter(pk=story.pk).update(views=F('views') + 1)
            story.refresh_from_db(fields=['views'])
        return Response({'views': story.views, 'viewed': True})

    @action(detail=True, methods=['post'])
    def view(self, request, pk=None):
        return self._record_view(request, pk)

    view.throttle_classes = [AnonRateThrottle]

    # Kept for the existing frontend call site — same behavior as `view`.
    @action(detail=True, methods=['post'], url_path='increment_views')
    def increment_views(self, request, pk=None):
        return self._record_view(request, pk)

    increment_views.throttle_classes = [AnonRateThrottle]

    @action(detail=True, methods=['get'])
    def viewers(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        if story.user_id != user.id and not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        rows = StoryView.objects.filter(story=story).select_related('viewer').order_by('-created_at')
        return Response(StoryViewerSerializer(rows, many=True).data)

    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        rtype = request.data.get('reaction')
        if rtype is not None and rtype not in VALID_REACTIONS:
            return Response({'detail': 'Invalid reaction.'}, status=400)

        existing = StoryReaction.objects.filter(story=story, user=user).first()
        if rtype is None or (existing and existing.type == rtype):
            if existing:
                existing.delete()
            my_reaction = None
        elif existing:
            existing.type = rtype
            existing.save(update_fields=['type'])
            my_reaction = rtype
        else:
            StoryReaction.objects.create(story=story, user=user, type=rtype)
            my_reaction = rtype
            create_notification(
                recipient_id=story.user_id,
                actor_id=user.id,
                verb='reaction',
                story=story,
                text='reacted to your story',
            )

        return Response({
            'reaction_counts': reaction_counts_for(story.reactions.all()),
            'my_reaction': my_reaction,
        })

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def reactors(self, request, pk=None):
        story = self.get_object()
        rtype = request.query_params.get('type')
        qs = StoryReaction.objects.filter(story=story).select_related('user').order_by('-created_at')
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
            'reaction_counts': reaction_counts_for(story.reactions.all()),
        })

    @action(detail=True, methods=['post'], url_path='submit_spotlight')
    def submit_spotlight(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        if story.user_id != user.id and not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        spotlight, created = StorySpotlight.objects.get_or_create(story=story)
        now = timezone.now()
        spotlight.status = 'featured'
        spotlight.featured_at = spotlight.featured_at or now
        spotlight.save(update_fields=['status', 'featured_at'])
        return Response(self._spotlight_payload(spotlight), status=201 if created else 200)

    def _spotlight_payload(self, spotlight):
        return {
            'id': spotlight.id,
            'story': spotlight.story_id,
            'status': spotlight.status,
            'score': spotlight.score,
            'featured_at': spotlight.featured_at,
            'created_at': spotlight.created_at,
        }

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def map(self, request):
        qs = self.get_queryset().filter(
            location_lat__isnull=False,
            location_lng__isnull=False,
        )
        bbox = (
            request.query_params.get('min_lat'),
            request.query_params.get('max_lat'),
            request.query_params.get('min_lng'),
            request.query_params.get('max_lng'),
        )
        if any(value not in (None, '') for value in bbox):
            try:
                min_lat, max_lat, min_lng, max_lng = [float(value) for value in bbox]
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'bbox requires min_lat,max_lat,min_lng,max_lng.'},
                    status=400,
                )
            qs = qs.filter(
                location_lat__gte=min_lat,
                location_lat__lte=max_lat,
                location_lng__gte=min_lng,
                location_lng__lte=max_lng,
            )

        rows = []
        for story in qs.select_related('user').order_by('-created_at')[:200]:
            avatar = None
            if story.user.avatar:
                avatar = request.build_absolute_uri(story.user.avatar.url)
            thumbnail = None
            if story.image:
                thumbnail = request.build_absolute_uri(story.image.url)
            rows.append({
                'id': story.id,
                'user': {
                    'id': story.user_id,
                    'username': story.user.username,
                    'avatar': avatar,
                },
                'location_name': story.location_name,
                'location_lat': story.location_lat,
                'location_lng': story.location_lng,
                'media': {
                    'thumbnail': thumbnail,
                },
                'created_at': story.created_at,
            })
        return Response(rows)

    @action(detail=True, methods=['post'], url_path='feature_spotlight')
    def feature_spotlight(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        if not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        story = self.get_object()
        spotlight, created = StorySpotlight.objects.get_or_create(story=story)
        spotlight.status = 'featured'
        spotlight.featured_at = timezone.now()
        spotlight.save(update_fields=['status', 'featured_at'])
        return Response(self._spotlight_payload(spotlight), status=201 if created else 200)

    @action(detail=True, methods=['post'], url_path='reject_spotlight')
    def reject_spotlight(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        if not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        story = self.get_object()
        spotlight, created = StorySpotlight.objects.get_or_create(story=story)
        spotlight.status = 'rejected'
        spotlight.featured_at = None
        spotlight.save(update_fields=['status', 'featured_at'])
        return Response(self._spotlight_payload(spotlight), status=201 if created else 200)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def spotlight(self, request):
        rows = Story.objects.filter(
            spotlight__status='featured',
            is_active=True,
            expires_at__gt=timezone.now(),
        ).select_related('user', 'spotlight').order_by('-spotlight__score', '-spotlight__featured_at')
        return Response(StorySerializer(rows, many=True, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path='save-to-constellation')
    def save_to_constellation(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        if story.user_id != user.id:
            return Response({'detail': 'Not allowed.'}, status=403)
        title = (request.data.get('title') or '').strip()[:40]
        if not title:
            title = MOOD_LABELS.get(story.mood, 'Highlights')
        constellation, _ = StoryConstellation.objects.get_or_create(user=user, title=title)
        story.constellation = constellation
        story.save(update_fields=['constellation'])
        max_order = (
            StoryHighlight.objects.filter(constellation=constellation)
            .order_by('-order')
            .values_list('order', flat=True)
            .first()
        ) or 0
        StoryHighlight.objects.get_or_create(
            constellation=constellation,
            story=story,
            defaults={'order': max_order + 1},
        )
        return Response(StoryConstellationSerializer(constellation, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='poll-vote')
    def poll_vote(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        overlay_id = request.data.get('overlay_id')
        option_index = request.data.get('option_index')
        if not overlay_id or option_index is None:
            return Response({'detail': 'overlay_id and option_index are required.'}, status=400)
        try:
            option_index = int(option_index)
        except (TypeError, ValueError):
            return Response({'detail': 'option_index must be an integer.'}, status=400)
        StoryPollVote.objects.update_or_create(
            story=story, overlay_id=overlay_id, voter=user,
            defaults={'option_index': option_index},
        )
        if story.user_id != user.id:
            create_notification(
                recipient_id=story.user_id,
                actor_id=user.id,
                verb='reaction',
                story=story,
                text='voted on your story poll',
            )
        votes = StoryPollVote.objects.filter(story=story, overlay_id=overlay_id)
        counts_qs = votes.values('option_index').annotate(c=Count('id'))
        counts = {str(row['option_index']): row['c'] for row in counts_qs}
        return Response({'counts': counts, 'total': votes.count(), 'my_vote': option_index})

    @action(detail=True, methods=['post'], url_path='question-response')
    def question_response(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        overlay_id = request.data.get('overlay_id')
        text = (request.data.get('text') or '').strip()[:200]
        if not overlay_id or not text:
            return Response({'detail': 'overlay_id and text are required.'}, status=400)
        StoryQuestionResponse.objects.create(story=story, overlay_id=overlay_id, responder=user, text=text)
        if story.user_id != user.id:
            create_notification(
                recipient_id=story.user_id,
                actor_id=user.id,
                verb='mention',
                story=story,
                text=f'answered your question: {text[:80]}',
            )
        return Response({'ok': True})

    @action(detail=True, methods=['get'], url_path='question-responses')
    def question_responses(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        if story.user_id != user.id and not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        qs = StoryQuestionResponse.objects.filter(story=story).select_related('responder').order_by('-created_at')
        overlay_id = request.query_params.get('overlay_id')
        if overlay_id:
            qs = qs.filter(overlay_id=overlay_id)
        return Response(StoryQuestionResponseSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        """Public quick reply on a story (thread visible to owner)."""
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        text = (request.data.get('text') or '').strip()[:500]
        if not text:
            return Response({'detail': 'text is required.'}, status=400)
        reply = StoryReply.objects.create(story=story, user=user, text=text)
        if story.user_id != user.id:
            create_notification(
                recipient_id=story.user_id,
                actor_id=user.id,
                verb='comment',
                story=story,
                text=f'replied to your story: {text[:80]}',
            )
        return Response(
            StoryReplySerializer(reply, context={'request': request}).data,
            status=201,
        )

    @action(detail=True, methods=['get'])
    def replies(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        if story.user_id != user.id and not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        qs = StoryReply.objects.filter(story=story).select_related('user').order_by('created_at')
        return Response(StoryReplySerializer(qs, many=True, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def archive(self, request):
        """All of the current user's own stories ever posted, regardless of
        expiry — like IG's Story Archive. Owner-only, bypasses get_queryset."""
        user, err = require_user(request)
        if err:
            return err
        qs = Story.objects.filter(user=user).select_related('user').order_by('-created_at')
        return Response(StorySerializer(qs, many=True, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def following(self, request):
        """Stories from users the current user follows, deduplicated per user."""
        viewer = user_from_request(request)
        if not viewer:
            return Response({'detail': 'Authentication required.'}, status=401)
        from users.models import Follow
        from users.social import feed_hidden_author_ids
        following_ids = Follow.objects.filter(follower=viewer).values_list('following_id', flat=True)
        qs = Story.objects.filter(
            is_active=True,
            expires_at__gt=timezone.now(),
            user_id__in=list(following_ids),
        ).select_related('user').order_by('-created_at')
        hidden = feed_hidden_author_ids(viewer.id)
        if hidden:
            qs = qs.exclude(user_id__in=hidden)
        close_friend_owner_ids = CloseFriend.objects.filter(friend=viewer).values_list('owner_id', flat=True)
        qs = qs.filter(
            Q(audience='everyone') | Q(user_id__in=close_friend_owner_ids)
        )
        data = StorySerializer(qs, many=True, context=self.get_serializer_context()).data
        # Group stories by user for bubble-style UIs.
        by_user = {}
        for item in data:
            uid = item['user']['id']
            by_user.setdefault(uid, {'user': item['user'], 'stories': []})
            by_user[uid]['stories'].append(item)
        return Response(list(by_user.values()))

    @action(detail=False, methods=['get'])
    def my(self, request):
        """Current user's active stories."""
        viewer = user_from_request(request)
        if not viewer:
            return Response({'detail': 'Authentication required.'}, status=401)
        qs = Story.objects.filter(
            is_active=True, expires_at__gt=timezone.now(), user=viewer
        ).select_related('user').order_by('-created_at')
        return Response(StorySerializer(qs, many=True, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path='toggle-save')
    def toggle_save(self, request, pk=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        with transaction.atomic():
            existing = SavedStory.objects.select_for_update().filter(user=user, story=story).first()
            if existing:
                existing.delete()
                saved = False
            else:
                SavedStory.objects.get_or_create(user=user, story=story)
                saved = True
        return Response({'saved': saved})

    @action(detail=False, methods=['get'], url_path='saved')
    def saved(self, request):
        user, err = require_user(request)
        if err:
            return err
        story_ids = list(
            SavedStory.objects.filter(user=user)
            .order_by('-created_at')
            .values_list('story_id', flat=True)
        )
        if not story_ids:
            return Response([])
        ordering = Case(
            *[When(id=story_id, then=position) for position, story_id in enumerate(story_ids)],
            output_field=IntegerField(),
        )
        qs = Story.objects.filter(id__in=story_ids).select_related('user').order_by(ordering)
        return Response(StorySerializer(qs, many=True, context={'request': request}).data)


class StoryConstellationViewSet(viewsets.ViewSet):
    """Manual Highlights (Outverse constellations) — create, list, open, add/remove stories."""
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.action in ('create', 'add_story', 'remove_story', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def list(self, request):
        user_id = request.query_params.get('user')
        if not user_id:
            viewer = user_from_request(request)
            if not viewer:
                return Response([])
            user_id = viewer.id
        cons = StoryConstellation.objects.filter(user_id=user_id).order_by('-created_at')
        return Response(StoryConstellationSerializer(cons, many=True, context={'request': request}).data)

    def create(self, request):
        user, err = require_user(request)
        if err:
            return err
        title = (request.data.get('title') or '').strip()[:40]
        if not title:
            return Response({'detail': 'title is required.'}, status=400)
        con, created = StoryConstellation.objects.get_or_create(user=user, title=title)
        status_code = 201 if created else 200
        return Response(
            StoryConstellationSerializer(con, context={'request': request}).data,
            status=status_code,
        )

    def retrieve(self, request, pk=None):
        try:
            con = StoryConstellation.objects.get(pk=pk)
        except StoryConstellation.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        from .models import StoryHighlight
        highlight_ids = list(
            StoryHighlight.objects.filter(constellation=con)
            .order_by('order', 'added_at')
            .values_list('story_id', flat=True)
        )
        if highlight_ids:
            stories = (
                Story.objects.filter(id__in=highlight_ids)
                .select_related('user')
            )
            by_id = {s.id: s for s in stories}
            ordered = [by_id[i] for i in highlight_ids if i in by_id]
        else:
            ordered = list(con.stories.select_related('user').order_by('created_at'))
        return Response({
            'id': con.id,
            'title': con.title,
            'cover': StoryConstellationSerializer(con, context={'request': request}).data.get('cover'),
            'stories': StorySerializer(ordered, many=True, context={'request': request}).data,
        })

    def partial_update(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        try:
            con = StoryConstellation.objects.get(pk=pk, user=user)
        except StoryConstellation.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        title = (request.data.get('title') or '').strip()[:40]
        if title:
            con.title = title
            con.save(update_fields=['title'])
        return Response(StoryConstellationSerializer(con, context={'request': request}).data)

    def destroy(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        StoryConstellation.objects.filter(pk=pk, user=user).delete()
        return Response(status=204)

    @action(detail=True, methods=['post'], url_path='add-story')
    def add_story(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        try:
            con = StoryConstellation.objects.get(pk=pk, user=user)
        except StoryConstellation.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        story_id = request.data.get('story_id')
        if not story_id:
            return Response({'detail': 'story_id is required.'}, status=400)
        try:
            story = Story.objects.get(pk=story_id, user=user)
        except Story.DoesNotExist:
            return Response({'detail': 'Story not found.'}, status=404)
        from .models import StoryHighlight
        max_order = (
            StoryHighlight.objects.filter(constellation=con)
            .order_by('-order')
            .values_list('order', flat=True)
            .first()
        ) or 0
        StoryHighlight.objects.get_or_create(
            constellation=con,
            story=story,
            defaults={'order': max_order + 1},
        )
        story.constellation = con
        story.save(update_fields=['constellation'])
        return Response(StoryConstellationSerializer(con, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='remove-story')
    def remove_story(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        try:
            con = StoryConstellation.objects.get(pk=pk, user=user)
        except StoryConstellation.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        story_id = request.data.get('story_id')
        if not story_id:
            return Response({'detail': 'story_id is required.'}, status=400)
        from .models import StoryHighlight
        StoryHighlight.objects.filter(constellation=con, story_id=story_id).delete()
        Story.objects.filter(id=story_id, user=user, constellation=con).update(constellation=None)
        return Response(StoryConstellationSerializer(con, context={'request': request}).data)


class CloseFriendViewSet(viewsets.ViewSet):
    """Manage the current user's own close-friends list (IG-style green ring
    audience). Always scoped to `request.user` — you can't view or edit
    anyone else's list."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        user, err = require_user(request)
        if err:
            return err
        rows = CloseFriend.objects.filter(owner=user).select_related('friend')
        return Response([
            {
                'id': row.friend.id,
                'username': row.friend.username,
                'avatar': row.friend.avatar.url if row.friend.avatar else None,
            }
            for row in rows
        ])

    def create(self, request):
        user, err = require_user(request)
        if err:
            return err
        friend_id = request.data.get('friend_id')
        if not friend_id or int(friend_id) == user.id:
            return Response({'detail': 'A valid friend_id is required.'}, status=400)
        if not User.objects.filter(id=friend_id).exists():
            return Response({'detail': 'User not found.'}, status=404)
        CloseFriend.objects.get_or_create(owner=user, friend_id=friend_id)
        return Response({'ok': True}, status=201)

    def destroy(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        CloseFriend.objects.filter(owner=user, friend_id=pk).delete()
        return Response(status=204)
