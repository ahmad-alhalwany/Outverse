from django.db import models as django_models
from django.db.models import F
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, ContentPostCreateThrottle, SearchAutocompleteThrottle, SearchQueryThrottle, ThrottleMixin

from .models import Resource
from .serializers import ResourceSerializer


class ResourceViewSet(ThrottleMixin, viewsets.ModelViewSet):
    serializer_class = ResourceSerializer

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

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        qs = Resource.objects.all()
        params = self.request.query_params
        resource_type = params.get('type')
        mood = params.get('mood')
        search = params.get('search')
        if resource_type and resource_type != 'all':
            qs = qs.filter(type=resource_type)
        if mood and mood != 'all':
            qs = qs.filter(mood=mood)
        if search:
            qs = qs.filter(
                django_models.Q(title__icontains=search) | django_models.Q(description__icontains=search)
            )
        return qs

    @action(detail=True, methods=['post'])
    def download(self, request, pk=None):
        Resource.objects.filter(pk=pk).update(download_count=F('download_count') + 1)
        resource = Resource.objects.get(pk=pk)
        serializer = self.get_serializer(resource)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-mood')
    def by_mood(self, request):
        mood = request.query_params.get('mood')
        if not mood:
            return Response({'error': 'mood query param is required.'}, status=400)
        qs = Resource.objects.filter(mood=mood)[:6]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
