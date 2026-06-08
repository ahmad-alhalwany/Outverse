from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ReelCommentViewSet, ReelMusicTrackViewSet, ReelViewSet

router = DefaultRouter()
router.register(r'reels', ReelViewSet, basename='reel')
router.register(r'reel-comments', ReelCommentViewSet, basename='reel-comment')
router.register(r'reel-music', ReelMusicTrackViewSet, basename='reel-music')

urlpatterns = [
    path('', include(router.urls)),
]
