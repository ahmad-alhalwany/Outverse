from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user, user_from_request

from .models import Segment, Story
from .serializers import (
    SegmentSerializer,
    StoryDetailSerializer,
    StorySerializer,
)


class StoryViewSet(viewsets.ModelViewSet):
    def get_permissions(self):
        if self.action in ('create', 'segments'):
            if self.request.method == 'POST':
                return [IsAuthenticated()]
        return [AllowAny()]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return StoryDetailSerializer
        return StorySerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_queryset(self):
        qs = Story.objects.all()
        params = self.request.query_params
        genre = params.get('genre')
        status_filter = params.get('status')
        ordering = params.get('ordering')
        owner = params.get('owner')
        if owner:
            qs = qs.filter(owner_id=owner)
        if genre and genre != 'all':
            qs = qs.filter(genre=genre)
        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)
        if ordering == 'new':
            return qs.order_by('-created_at')
        return qs.order_by('-updated_at')

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def featured(self, request):
        stories = Story.objects.filter(is_featured=True).order_by('-updated_at')[:6]
        serializer = StorySerializer(
            stories, many=True, context=self.get_serializer_context()
        )
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def segments(self, request, pk=None):
        story = self.get_object()
        if request.method == 'POST':
            user, err = require_user(request)
            if err:
                return err
            if story.status == 'completed':
                return Response(
                    {'error': 'This story is already complete.'}, status=400
                )
            content = (request.data.get('content') or '').strip()
            if not content:
                return Response({'error': 'Content is required.'}, status=400)
            count = story.segments.count()
            if count >= story.max_segments:
                story.status = 'completed'
                story.save(update_fields=['status'])
                return Response({'error': 'This story is full.'}, status=400)
            segment = Segment.objects.create(
                story=story,
                author=user,
                content=content,
                order=count + 1,
            )
            story.save(update_fields=['updated_at'])
            if story.segments.count() >= story.max_segments:
                story.status = 'completed'
                story.save(update_fields=['status'])
            serializer = SegmentSerializer(
                segment, context=self.get_serializer_context()
            )
            return Response(serializer.data, status=201)
        segments = story.segments.all()
        serializer = SegmentSerializer(
            segments, many=True, context=self.get_serializer_context()
        )
        return Response(serializer.data)
