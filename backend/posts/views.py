from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import F
from .models import Post
from .serializers import PostSerializer

# Create your views here.

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer
    
    def perform_create(self, serializer):
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def increment_views(self, request, pk=None):
        post = self.get_object()
        post.views = F('views') + 1
        post.save()
        post.refresh_from_db()
        return Response({'views': post.views})
    
    @action(detail=True, methods=['post'])
    def increment_likes(self, request, pk=None):
        post = self.get_object()
        post.likes_count = F('likes_count') + 1
        post.save()
        post.refresh_from_db()
        return Response({'likes_count': post.likes_count})
    
    def list(self, request, *args, **kwargs):
        """تحديث عدد التعليقات لجميع المنشورات قبل إرجاعها"""
        queryset = self.get_queryset()
        for post in queryset:
            post.update_comments_count()
        return super().list(request, *args, **kwargs)
