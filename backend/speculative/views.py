from django.db import transaction
from django.db.models import Count, F, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, ContentPostCreateThrottle, ThrottleMixin

from outverse.auth_utils import require_user, user_from_request
from users.models import Profile

from .models import Character, CharacterOwnership, FailedIdea, FailedIdeaComment, FutureMemory
from .serializers import (
    CharacterSerializer,
    FailedIdeaCommentSerializer,
    FailedIdeaSerializer,
    FutureMemorySerializer,
)


class FailedIdeaViewSet(ThrottleMixin, viewsets.ModelViewSet):
    serializer_class = FailedIdeaSerializer
    throttle_scopes = {
        'create': 'content.post_create',
        'perform_create': 'content.post_create',
        'update': 'content.draft_write',
        'partial_update': 'content.draft_write',
        'perform_update': 'content.draft_write',
        'destroy': 'content.draft_write',
        'perform_destroy': 'content.draft_write',
        'list': 'anon.read',
        'retrieve': 'anon.read',
    }

    queryset = FailedIdea.objects.select_related('user')

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'like'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        viewer = user_from_request(self.request)
        if viewer:
            ctx['liked_failed_idea_ids'] = set(
                viewer.liked_failed_ideas.values_list('id', flat=True)
            )
        return ctx

    def get_queryset(self):
        qs = super().get_queryset()
        exhibition = self.request.query_params.get('exhibition')
        if exhibition and exhibition != 'all':
            qs = qs.filter(exhibition=exhibition)
        if self.request.query_params.get('ordering') == 'top':
            qs = qs.annotate(
                engagement=Count('likes', distinct=True) + Count('comments', distinct=True)
            ).order_by('-engagement', '-created_at')
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='like')
    def like(self, request, pk=None):
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if idea.likes.filter(id=user.id).exists():
            idea.likes.remove(user)
            liked = False
        else:
            idea.likes.add(user)
            liked = True
        return Response({'liked': liked, 'likes_count': idea.likes.count()})

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        idea = self.get_object()
        if request.method == 'GET':
            rows = FailedIdeaComment.objects.filter(failed_idea=idea).select_related('user')
            return Response(FailedIdeaCommentSerializer(rows, many=True).data)

        user, err = require_user(request)
        if err:
            return err
        serializer = FailedIdeaCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = FailedIdeaComment.objects.create(
            failed_idea=idea,
            user=user,
            content=serializer.validated_data['content'],
        )
        return Response(FailedIdeaCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class FutureMemoryViewSet(ThrottleMixin, viewsets.ModelViewSet):
    serializer_class = FutureMemorySerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated:
            return FutureMemory.objects.filter(Q(is_public=True) | Q(user_id=user.id)).select_related('user')
        return FutureMemory.objects.filter(is_public=True).select_related('user')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CharacterViewSet(ThrottleMixin, viewsets.ModelViewSet):
    serializer_class = CharacterSerializer
    queryset = Character.objects.select_related('creator')

    def get_permissions(self):
        if self.action in ('summon',):
            return [IsAuthenticated()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [AllowAny()]

    @action(detail=True, methods=['post'])
    def summon(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        with transaction.atomic():
            character = Character.objects.select_for_update().get(pk=pk)
            if CharacterOwnership.objects.filter(character=character, user_id=user.id).exists():
                return Response({'error': 'You already own this character.'}, status=status.HTTP_400_BAD_REQUEST)
            profile = Profile.objects.select_for_update().get_or_create(user=user)[0]
            if profile.points < character.price:
                return Response(
                    {'error': 'Insufficient coins.', 'balance': profile.points, 'price': character.price},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profile.points = F('points') - character.price
            profile.save(update_fields=['points'])
            CharacterOwnership.objects.create(character=character, user=user)
            profile.refresh_from_db(fields=['points'])
        serializer = CharacterSerializer(character, context={'request': request})
        data = serializer.data
        data['balance'] = profile.points
        return Response(data, status=status.HTTP_201_CREATED)
