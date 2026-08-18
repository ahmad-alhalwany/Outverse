from datetime import timedelta

from django.utils import timezone

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import user_from_request

from .models import TimeCapsule
from .serializers import TimeCapsuleCreateSerializer, TimeCapsuleSerializer


class TimeCapsuleViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Time capsules — sealed messages to your future self.

    ``GET /api/capsules/mine/``
        List the caller's capsules. Locked ones return metadata only —
        text and voice are blanked until ``open_at`` passes.

    ``POST /api/capsules/``
        Create a capsule. Body: ``{text, open_at, voice?}``.
        ``open_at`` must be in the future.

    ``POST /api/capsules/{id}/open/``
        Reveal a capsule whose ``open_at`` has passed. Stamps ``opened_at``
        the first time and returns the unsealed payload.
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = user_from_request(self.request)
        if not user:
            return TimeCapsule.objects.none()
        return TimeCapsule.objects.filter(user=user)

    def get_serializer_class(self):
        if self.action in ('create',):
            return TimeCapsuleCreateSerializer
        return TimeCapsuleSerializer

    def perform_create(self, serializer):
        user = user_from_request(self.request)
        serializer.save(user=user)

    def create(self, request, *args, **kwargs):
        # The write serializer only exposes text/voice/open_at; respond with
        # the full read representation so the client gets id/created_at/
        # is_unlocked immediately instead of an incomplete object.
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = TimeCapsuleSerializer(serializer.instance, context=self.get_serializer_context())
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    def list(self, request, *args, **kwargs):
        # Override list to use the /mine/ action semantics.
        return self.mine(request)

    @action(detail=False, methods=['get'], url_path='mine')
    def mine(self, request):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='open')
    def open(self, request, pk=None):
        capsule = self.get_object()
        if not capsule.is_unlocked:
            remaining = capsule.open_at - timezone.now()
            days = max(1, remaining.days)
            return Response(
                {'detail': f'This capsule unlocks in {days} day(s).', 'opens_at': capsule.open_at},
                status=status.HTTP_403_FORBIDDEN,
            )
        if capsule.opened_at is None:
            capsule.opened_at = timezone.now()
            capsule.save(update_fields=['opened_at'])
        serializer = self.get_serializer(capsule)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Quick counts for the UI: sealed vs. ready-to-open."""
        qs = self.get_queryset()
        now = timezone.now()
        sealed = qs.filter(open_at__gt=now).count()
        ready = qs.filter(open_at__lte=now, opened_at__isnull=True).count()
        opened = qs.filter(opened_at__isnull=False).count()
        return Response({'sealed': sealed, 'ready': ready, 'opened': opened})

    @action(detail=False, methods=['post'], url_path='polish-tone')
    def polish_tone(self, request):
        """Optional Vault tone polish before sealing a capsule."""
        from outverse.auth_utils import require_user
        from outverse.ai_coaches import polish_tone as _polish
        user, err = require_user(request)
        if err:
            return err
        text = (request.data.get('text') or '').strip()
        if len(text) < 2:
            return Response({'detail': 'text required.'}, status=400)
        lang = (request.data.get('lang') or 'en')[:2]
        return Response(_polish(text=text, kind='capsule', language=lang if lang in ('en', 'ar') else 'en'))
