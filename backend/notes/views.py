from datetime import timedelta

from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, ContentPostCreateThrottle, ThrottleMixin

from outverse.auth_utils import require_user, user_from_request
from users.models import Follow

from .models import Note
from .serializers import NoteSerializer


class NoteViewSet(ThrottleMixin, viewsets.ModelViewSet):
    serializer_class = NoteSerializer
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

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Note.objects.filter(expires_at__gt=timezone.now())

    def perform_create(self, serializer):
        expires_in = self.request.data.get('expires_in', '24h')
        hours = 24 if expires_in == '24h' else (168 if expires_in == '7d' else 24)
        serializer.save(
            user=user_from_request(self.request),
            expires_at=timezone.now() + timedelta(hours=hours),
        )

    def destroy(self, request, *args, **kwargs):
        note = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if note.user_id != user.id and not user.is_staff:
            return Response({'detail': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def following(self, request):
        viewer = user_from_request(request)
        if not viewer:
            return Response({'detail': 'Authentication required.'}, status=401)
        following_ids = Follow.objects.filter(follower=viewer).values_list('following_id', flat=True)
        qs = Note.objects.filter(
            user_id__in=list(following_ids),
            expires_at__gt=timezone.now(),
        ).select_related('user').order_by('-created_at')
        return Response(NoteSerializer(qs, many=True, context={'request': request}).data)
