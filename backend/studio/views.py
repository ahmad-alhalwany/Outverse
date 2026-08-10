from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from notifications.utils import create_notification
from users.models import Follow

from .models import CanvasMedia, CanvasStroke, DrawSession, SessionInvite
from .serializers import (
    CanvasMediaSerializer,
    CanvasStrokeSerializer,
    DrawSessionDetailSerializer,
    DrawSessionListSerializer,
)


class DrawSessionViewSet(viewsets.ModelViewSet):
    queryset = DrawSession.objects.select_related('host').filter(is_live=True)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DrawSessionDetailSerializer
        return DrawSessionListSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'add_media', 'add_stroke', 'invite'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == 'retrieve':
            qs = qs.prefetch_related('strokes__user', 'media__user', 'participants__user')
        return qs

    def perform_create(self, serializer):
        serializer.save(host=self.request.user)

    @action(detail=True, methods=['post'], url_path='media')
    def add_media(self, request, pk=None):
        session = self.get_object()
        image = request.data.get('image')
        if not image:
            return Response({'error': 'An image file is required.'}, status=status.HTTP_400_BAD_REQUEST)
        media = CanvasMedia.objects.create(
            session=session,
            user=request.user,
            image=image,
            x=float(request.data.get('x', 40)),
            y=float(request.data.get('y', 40)),
            width=float(request.data.get('width', 200)),
            height=float(request.data.get('height', 200)),
        )
        return Response(
            CanvasMediaSerializer(media, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='strokes')
    def add_stroke(self, request, pk=None):
        """Solo mode's entire sync mechanism — no socket involved."""
        session = self.get_object()
        stroke = CanvasStroke.objects.create(
            session=session,
            user=request.user,
            points=request.data.get('points', []),
            color=request.data.get('color', '#5B21B6'),
            width=int(request.data.get('width', 3)),
        )
        return Response(
            CanvasStrokeSerializer(stroke, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='invite')
    def invite(self, request, pk=None):
        session = self.get_object()
        if session.host_id != request.user.id:
            return Response({'error': 'Only the host can invite.'}, status=status.HTTP_403_FORBIDDEN)
        to_user_id = request.data.get('to_user_id')
        if not to_user_id:
            return Response({'error': 'to_user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if str(to_user_id) == str(request.user.id):
            return Response({'error': "You can't invite yourself."}, status=status.HTTP_400_BAD_REQUEST)
        if not Follow.objects.filter(follower_id=request.user.id, following_id=to_user_id).exists():
            return Response({'error': 'You can only invite people you follow.'}, status=status.HTTP_400_BAD_REQUEST)

        SessionInvite.objects.create(session=session, from_user=request.user, to_user_id=to_user_id)
        if session.mode != 'live':
            session.mode = 'live'
            session.save(update_fields=['mode'])
        create_notification(
            recipient_id=to_user_id,
            actor_id=request.user.id,
            verb='studio_invite',
            studio_session=session,
            text=f'{request.user.username} invited you to a live Creation Studio session.',
        )
        return Response(DrawSessionDetailSerializer(session, context={'request': request}).data)
