from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .live_views import LiveChatMessageViewSet, LiveReactionViewSet, LiveSessionViewSet
from .video_views import LongFormVideoViewSet, VideoPlaylistViewSet
from .views import (
    ReelCommentViewSet,
    ReelDraftViewSet,
    ReelMusicTrackViewSet,
    ReelTemplateViewSet,
    ReelViewSet,
)

router = DefaultRouter()
router.register(r'reels', ReelViewSet, basename='reel')
router.register(r'reel-drafts', ReelDraftViewSet, basename='reel-draft')
router.register(r'reel-comments', ReelCommentViewSet, basename='reel-comment')
router.register(r'reel-music', ReelMusicTrackViewSet, basename='reel-music')
router.register(r'reel-templates', ReelTemplateViewSet, basename='reel-template')
router.register(r'live', LiveSessionViewSet, basename='live-session')
router.register(r'live-chat', LiveChatMessageViewSet, basename='live-chat')
router.register(r'live-reactions', LiveReactionViewSet, basename='live-reaction')
router.register(r'videos', LongFormVideoViewSet, basename='longform-video')
router.register(r'playlists', VideoPlaylistViewSet, basename='video-playlist')

urlpatterns = [
    path('', include(router.urls)),
]
