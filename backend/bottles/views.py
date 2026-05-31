from collections import Counter
from datetime import timedelta

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user, user_from_request

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


def active_drifting_bottles():
    return MessageBottle.objects.filter(
        location_lat__isnull=False,
        location_lng__isnull=False,
        expiry_time__gt=timezone.now(),
        caught_by__isnull=True,
        is_opened=False,
    )


def _viewer_context(request):
    return {'request': request}


class MessageBottleViewSet(viewsets.ModelViewSet):
    queryset = MessageBottle.objects.all()
    serializer_class = BottleThrowSerializer

    def get_permissions(self):
        if self.action in ('throw', 'catch', 'create'):
            return [IsAuthenticated()]
        if self.action == 'my_bottles':
            return [IsAuthenticated()]
        return [AllowAny()]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        data = BottleRecentSerializer(
            instance, context=_viewer_context(request)
        ).data
        data['is_active'] = _bottle_is_drifting(instance)
        return Response(data)

    @action(detail=False, methods=['post'])
    def throw(self, request):
        serializer = self.get_serializer(
            data=request.data, context=_viewer_context(request)
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get', 'post'])
    def catch(self, request):
        user, err = require_user(request)
        if err:
            return err

        qs = MessageBottle.objects.filter(
            is_opened=False,
            caught_by__isnull=True,
            expiry_time__gt=timezone.now(),
        ).exclude(sender_id=user.id)

        bottle = qs.order_by('?').first()
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
        bottle.save()

        return Response(BottleCatchSerializer(bottle).data)

    @action(detail=False, methods=['get'])
    def my_bottles(self, request):
        user, err = require_user(request)
        if err:
            return err
        active = request.query_params.get('active', '').lower() in ('1', 'true', 'yes')
        qs = MessageBottle.objects.filter(sender_id=user.id)
        if active:
            qs = qs.filter(
                expiry_time__gt=timezone.now(),
                caught_by__isnull=True,
                is_opened=False,
            )
        serializer = BottleThrowSerializer(
            qs.order_by('-created_at')[:48], many=True
        )
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
        viewer = user_from_request(request)
        user_id = request.query_params.get('user') or request.query_params.get('user_id')
        if not user_id and viewer:
            user_id = viewer.id
        if not user_id:
            return Response({'error': 'user query param or auth required.'}, status=400)

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
