import random

from django.db import transaction
from django.db.models import Count, F, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, ContentPostCreateThrottle, ThrottleMixin

from moderation.ai_moderation import is_content_blocked
from outverse.auth_utils import require_user, user_from_request
from users.models import Profile

from .character_ai import DEFAULT_PRICE_BY_RARITY, RARITY_ORDER, generate_character, next_rarity
from .models import Character, CharacterOwnership, FailedIdea, FailedIdeaComment, FutureMemory
from .serializers import (
    CharacterSerializer,
    FailedIdeaCommentSerializer,
    FailedIdeaSerializer,
    FutureMemorySerializer,
)

MYSTERY_SUMMON_COST = 120
CREATE_CUSTOM_COST = 150
RARITY_WEIGHTS = {'rare': 0.7, 'epic': 0.25, 'legendary': 0.05}


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

    def update(self, request, *args, **kwargs):
        idea = self.get_object()
        if idea.user_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        idea = self.get_object()
        if idea.user_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

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
        target_user_id = self.request.query_params.get('user')
        if target_user_id:
            qs = FutureMemory.objects.filter(user_id=target_user_id)
            if not (user and user.is_authenticated and str(user.id) == str(target_user_id)):
                qs = qs.filter(is_public=True)
            return qs.select_related('user')
        if user and user.is_authenticated:
            return FutureMemory.objects.filter(Q(is_public=True) | Q(user_id=user.id)).select_related('user')
        return FutureMemory.objects.filter(is_public=True).select_related('user')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        memory = self.get_object()
        if memory.user_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        memory = self.get_object()
        if memory.user_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)


class CharacterViewSet(ThrottleMixin, viewsets.ModelViewSet):
    serializer_class = CharacterSerializer
    queryset = Character.objects.select_related('creator')

    def get_permissions(self):
        if self.action in ('summon', 'mine', 'merge', 'create_custom', 'mystery_summon'):
            return [IsAuthenticated()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == 'list':
            qs = qs.filter(is_public=True)
        return qs

    @action(detail=False, methods=['get'], url_path='mine')
    def mine(self, request):
        user, err = require_user(request)
        if err:
            return err
        owned = Character.objects.filter(owners__user_id=user.id).select_related('creator').order_by('-owners__summoned_at')
        return Response(CharacterSerializer(owned, many=True, context={'request': request}).data)

    @action(detail=False, methods=['post'], url_path='merge')
    def merge(self, request):
        user, err = require_user(request)
        if err:
            return err
        ids = request.data.get('character_ids') or []
        if not isinstance(ids, list) or len(ids) != 2 or ids[0] == ids[1]:
            return Response({'error': 'Pick two different owned characters.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # No .distinct() needed: CharacterOwnership.unique_together('character','user')
            # already guarantees at most one matching ownership row per character here.
            chars = list(
                Character.objects.select_for_update()
                .filter(id__in=ids, owners__user_id=user.id)
            )
            if len(chars) != 2:
                return Response({'error': 'You must own both characters.'}, status=status.HTTP_400_BAD_REQUEST)
            if chars[0].rarity != chars[1].rarity:
                return Response({'error': 'Both characters must be the same rarity.'}, status=status.HTTP_400_BAD_REQUEST)

            upgraded_rarity = next_rarity(chars[0].rarity)
            if not upgraded_rarity:
                return Response({'error': 'Legendary characters cannot be merged further.'}, status=status.HTTP_400_BAD_REQUEST)

            payload = generate_character(
                source_names=(chars[0].name, chars[1].name),
                rarity=upgraded_rarity,
            )
            fused = Character.objects.create(
                name=payload['name'],
                description=payload['description'],
                emoji=payload.get('emoji', ''),
                rarity=upgraded_rarity,
                price=DEFAULT_PRICE_BY_RARITY[upgraded_rarity],
                creator=user,
                is_ai_generated=payload.get('is_ai_generated', False),
                is_public=True,
            )
            CharacterOwnership.objects.filter(character_id__in=ids, user_id=user.id).delete()
            CharacterOwnership.objects.create(character=fused, user=user)

        return Response(CharacterSerializer(fused, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='create-custom')
    def create_custom(self, request):
        user, err = require_user(request)
        if err:
            return err
        prompt = (request.data.get('prompt') or '').strip()[:300]
        if not prompt:
            return Response({'error': 'Describe your character first.'}, status=status.HTTP_400_BAD_REQUEST)
        if is_content_blocked(prompt):
            return Response({'error': "That description isn't allowed. Try something else."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            profile = Profile.objects.select_for_update().get_or_create(user=user)[0]
            if profile.points < CREATE_CUSTOM_COST:
                return Response(
                    {'error': 'Insufficient coins.', 'balance': profile.points, 'price': CREATE_CUSTOM_COST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payload = generate_character(prompt=prompt, rarity='rare', language=request.data.get('language') or 'en')
            if is_content_blocked(payload['name']) or is_content_blocked(payload['description']):
                return Response(
                    {'error': 'Could not generate a safe character from that prompt. Try rephrasing.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            character = Character.objects.create(
                name=payload['name'],
                description=payload['description'],
                emoji=payload.get('emoji', ''),
                rarity='rare',
                price=DEFAULT_PRICE_BY_RARITY['rare'],
                creator=user,
                is_ai_generated=payload.get('is_ai_generated', False),
                is_public=False,
            )
            profile.points = F('points') - CREATE_CUSTOM_COST
            profile.save(update_fields=['points'])
            CharacterOwnership.objects.create(character=character, user=user)
            profile.refresh_from_db(fields=['points'])

        data = CharacterSerializer(character, context={'request': request}).data
        data['balance'] = profile.points
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='mystery-summon')
    def mystery_summon(self, request):
        user, err = require_user(request)
        if err:
            return err
        with transaction.atomic():
            profile = Profile.objects.select_for_update().get_or_create(user=user)[0]
            if profile.points < MYSTERY_SUMMON_COST:
                return Response(
                    {'error': 'Insufficient coins.', 'balance': profile.points, 'price': MYSTERY_SUMMON_COST},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            owned_ids = set(Character.objects.filter(owners__user_id=user.id).values_list('id', flat=True))
            rolled = random.choices(RARITY_ORDER, weights=[RARITY_WEIGHTS[r] for r in RARITY_ORDER], k=1)[0]

            pool = list(
                Character.objects.filter(is_public=True, rarity=rolled).exclude(id__in=owned_ids)
            )
            if not pool:
                pool = list(
                    Character.objects.filter(is_public=True).exclude(id__in=owned_ids)
                )
            if not pool:
                return Response({'error': 'You already own every available character.'}, status=status.HTTP_400_BAD_REQUEST)

            won = random.choice(pool)
            profile.points = F('points') - MYSTERY_SUMMON_COST
            profile.save(update_fields=['points'])
            CharacterOwnership.objects.create(character=won, user=user)
            profile.refresh_from_db(fields=['points'])

        data = CharacterSerializer(won, context={'request': request}).data
        data['balance'] = profile.points
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def summon(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        with transaction.atomic():
            character = Character.objects.select_for_update().filter(
                Q(is_public=True) | Q(creator_id=user.id)
            ).filter(pk=pk).first()
            if not character:
                return Response({'error': 'Character not found.'}, status=status.HTTP_404_NOT_FOUND)
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
