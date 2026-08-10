from django.db import transaction
from django.db.models import F, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, ContentPostCreateThrottle, ThrottleMixin

from outverse.auth_utils import require_user
from users.models import Profile

from .models import Character, CharacterOwnership, FailedIdea, FutureMemory
from .serializers import (
    CharacterSerializer,
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
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        qs = super().get_queryset()
        exhibition = self.request.query_params.get('exhibition')
        if exhibition and exhibition != 'all':
            qs = qs.filter(exhibition=exhibition)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


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
