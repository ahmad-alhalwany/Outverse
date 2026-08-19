from collections import Counter
from datetime import timedelta

from django.db.models import Max, Min
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, ContentPostCreateThrottle, ThrottleMixin

from outverse.auth_utils import require_user

from .models import MessageBottle
from .serializers import (
    BottleCatchSerializer,
    BottleMapSerializer,
    BottleRecentSerializer,
    BottleThrowSerializer,
)


def _bottle_is_drifting(bottle):
    return (
        bottle.expiry_time > timezone.now()
        and bottle.caught_by_id is None
        and not bottle.is_opened
    )


def _hidden_from_map_sender_ids():
    """Senders whose bottle_privacy keeps them off the public map/recent feed."""
    from preferences.models import UserPreferences

    return UserPreferences.objects.filter(
        bottle_privacy__in=['catch_only', 'private'],
    ).values_list('user_id', flat=True)


def _hidden_from_catch_sender_ids():
    """Senders whose bottle_privacy keeps them fully out of the catch pool."""
    from preferences.models import UserPreferences

    return UserPreferences.objects.filter(bottle_privacy='private').values_list('user_id', flat=True)


def active_drifting_bottles():
    return MessageBottle.objects.select_related('sender').filter(
        location_lat__isnull=False,
        location_lng__isnull=False,
        expiry_time__gt=timezone.now(),
        caught_by__isnull=True,
        is_opened=False,
    ).exclude(sender_id__in=_hidden_from_map_sender_ids())


def _viewer_context(request):
    return {'request': request}


def _random_bottle(qs):
    bounds = qs.aggregate(min_id=Min('id'), max_id=Max('id'))
    min_id = bounds['min_id']
    max_id = bounds['max_id']
    if min_id is None or max_id is None:
        return None
    import random
    pivot = random.randint(min_id, max_id)
    bottle = qs.filter(id__gte=pivot).order_by('id').first()
    if bottle:
        return bottle
    return qs.filter(id__lt=pivot).order_by('id').first()


def _moderate_bottle(bottle, user):
    try:
        from moderation.hooks import enforce_moderation_result, soft_moderate_content

        result = soft_moderate_content(
            text=bottle.message or '',
            content_type='bottle',
            object_id=bottle.id,
            user=user,
        )
        if result.get('hard_block') or result.get('bottle_block'):
            enforce_moderation_result(
                result,
                content_type='bottle',
                object_id=bottle.id,
            )
            return result
        return result
    except Exception:
        return {'flagged': False}


def _precheck_bottle_message(text, user):
    """Block severe language before a bottle is created."""
    from moderation.hooks import check_severe_language, soft_moderate_content

    severe = check_severe_language(text or '')
    if severe:
        return {
            'blocked': True,
            'detail': 'This message cannot be thrown — please keep the vault kind and safe.',
        }
    result = soft_moderate_content(
        text=text or '',
        content_type='bottle',
        object_id=None,
        user=user,
    )
    if result.get('hard_block') or result.get('bottle_block'):
        return {
            'blocked': True,
            'detail': 'This message was blocked by safety filters. Soften the language and try again.',
        }
    return {'blocked': False, 'result': result}


class MessageBottleViewSet(ThrottleMixin, viewsets.ModelViewSet):
    queryset = MessageBottle.objects.all()
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

    serializer_class = BottleThrowSerializer

    def get_permissions(self):
        if self.action in ('throw', 'catch', 'create', 'polish_tone'):
            return [IsAuthenticated()]
        if self.action in ('my_bottles', 'caught', 'dashboard'):
            return [IsAuthenticated()]
        if self.action == 'destroy':
            return [IsAuthenticated()]
        if self.action == 'list':
            # No real feature lists every bottle unauthenticated — the default
            # ModelViewSet list would otherwise leak every message ever thrown.
            return [IsAdminUser()]
        return [AllowAny()]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        data = BottleRecentSerializer(
            instance, context=_viewer_context(request)
        ).data
        data['is_active'] = _bottle_is_drifting(instance)
        return Response(data)

    def destroy(self, request, *args, **kwargs):
        bottle = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if bottle.sender_id != user.id and not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        bottle = serializer.save()
        _moderate_bottle(bottle, self.request.user)

    @action(detail=False, methods=['post'])
    def throw(self, request):
        user, err = require_user(request)
        if err:
            return err
        message = (request.data.get('message') or '').strip()
        pre = _precheck_bottle_message(message, user)
        if pre.get('blocked'):
            return Response({'detail': pre['detail']}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(
            data=request.data, context=_viewer_context(request)
        )
        serializer.is_valid(raise_exception=True)
        bottle = serializer.save()
        result = _moderate_bottle(bottle, user)
        if result and (result.get('hard_block') or result.get('bottle_block')):
            return Response(
                {'detail': 'This message was blocked by safety filters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='polish-tone')
    def polish_tone(self, request):
        """Optional Vault tone polish before throwing a bottle."""
        user, err = require_user(request)
        if err:
            return err
        from outverse.ai_coaches import polish_tone as _polish
        text = (request.data.get('text') or '').strip()
        if len(text) < 2:
            return Response({'detail': 'text required.'}, status=400)
        lang = (request.data.get('lang') or 'en')[:2]
        return Response(_polish(text=text, kind='bottle', language=lang if lang in ('en', 'ar') else 'en'))

    @action(detail=False, methods=['get', 'post'])
    def catch(self, request):
        user, err = require_user(request)
        if err:
            return err

        qs = MessageBottle.objects.filter(
            is_opened=False,
            caught_by__isnull=True,
            expiry_time__gt=timezone.now(),
        ).exclude(sender_id=user.id).exclude(sender_id__in=_hidden_from_catch_sender_ids())

        bottle_id = request.data.get('bottle_id') or request.query_params.get('bottle_id')
        if bottle_id:
            bottle = qs.filter(pk=bottle_id).first()
        else:
            bottle = _random_bottle(qs)

        if not bottle:
            return Response(
                {'detail': 'The cosmic sea is empty for now. Try again soon.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        bottle.is_opened = True
        bottle.is_read = True
        bottle.read_at = timezone.now()
        bottle.caught_at = timezone.now()
        bottle.caught_by_id = user.id
        bottle.save(update_fields=[
            'is_opened', 'is_read', 'read_at', 'caught_at', 'caught_by_id',
        ])

        return Response(BottleCatchSerializer(bottle).data)

    @action(detail=False, methods=['get'])
    def my_bottles(self, request):
        user, err = require_user(request)
        if err:
            return err
        active = request.query_params.get('active', '').lower() in ('1', 'true', 'yes')
        emotion = request.query_params.get('emotion', '').strip().lower()
        start_date = request.query_params.get('start_date', '').strip()
        end_date = request.query_params.get('end_date', '').strip()
        qs = MessageBottle.objects.filter(sender_id=user.id)
        if active:
            qs = qs.filter(
                expiry_time__gt=timezone.now(),
                caught_by__isnull=True,
                is_opened=False,
            )
        if emotion:
            qs = qs.filter(emotion_type=emotion)
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)
        serializer = BottleThrowSerializer(
            qs.order_by('-created_at')[:48], many=True
        )
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def caught(self, request):
        user, err = require_user(request)
        if err:
            return err
        emotion = request.query_params.get('emotion', '').strip().lower()
        start_date = request.query_params.get('start_date', '').strip()
        end_date = request.query_params.get('end_date', '').strip()
        qs = MessageBottle.objects.filter(caught_by_id=user.id)
        if emotion:
            qs = qs.filter(emotion_type=emotion)
        if start_date:
            qs = qs.filter(caught_at__date__gte=start_date)
        if end_date:
            qs = qs.filter(caught_at__date__lte=end_date)
        serializer = BottleThrowSerializer(qs.order_by('-caught_at', '-created_at')[:48], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def map(self, request):
        qs = active_drifting_bottles().order_by('-created_at')[:120]
        data = BottleMapSerializer(
            qs, many=True, context=_viewer_context(request)
        ).data
        return Response(data)

    @action(detail=False, methods=['get'])
    def recent(self, request):
        qs = active_drifting_bottles().order_by('-created_at')[:8]
        data = BottleRecentSerializer(
            qs, many=True, context=_viewer_context(request)
        ).data
        return Response(data)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        user, err = require_user(request)
        if err:
            return err
        user_id = user.id

        thrown_qs = MessageBottle.objects.filter(sender_id=user_id)
        caught = MessageBottle.objects.filter(caught_by_id=user_id).count()
        thrown = thrown_qs.count()

        today = timezone.localdate()
        start = today - timedelta(days=29)
        recent_bottles = thrown_qs.filter(
            created_at__date__gte=start
        ).order_by('created_at')

        per_day = {}
        for b in recent_bottles:
            per_day[timezone.localtime(b.created_at).date()] = b.emotion_type

        timeline = []
        for i in range(30):
            d = start + timedelta(days=i)
            timeline.append({
                'day': i + 1,
                'date': d.isoformat(),
                'emotion': per_day.get(d),
            })

        emotions = list(thrown_qs.values_list('emotion_type', flat=True))
        counts = Counter(emotions)
        total = len(emotions)
        insights = [
            {'emotion': key, 'pct': round(n / total * 100)}
            for key, n in counts.most_common(4)
        ] if total else []

        current_mood = None
        latest = thrown_qs.order_by('-created_at').first()
        if latest:
            current_mood = latest.emotion_type

        return Response({
            'thrown': thrown,
            'caught': caught,
            'timeline': timeline,
            'insights': insights,
            'current_mood': current_mood,
        })
