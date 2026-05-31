from django.db.models import F
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user

from .models import Story
from .serializers import StorySerializer


class StoryViewSet(viewsets.ModelViewSet):
    queryset = Story.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = StorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def perform_create(self, serializer):
        serializer.save()

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def increment_views(self, request, pk=None):
        story = self.get_object()
        story.views = F('views') + 1
        story.save()
        story.refresh_from_db()
        return Response({'views': story.views})
