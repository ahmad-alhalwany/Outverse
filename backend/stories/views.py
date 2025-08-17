from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import F
from .models import Story
from .serializers import StorySerializer

# Create your views here.

class StoryViewSet(viewsets.ModelViewSet):
    queryset = Story.objects.filter(is_active=True).order_by('-created_at')
    serializer_class = StorySerializer
    
    def perform_create(self, serializer):
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def increment_views(self, request, pk=None):
        story = self.get_object()
        story.views = F('views') + 1
        story.save()
        story.refresh_from_db()
        return Response({'views': story.views})
