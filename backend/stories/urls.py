from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CloseFriendViewSet, StoryConstellationViewSet, StoryViewSet

router = DefaultRouter()
router.register(r'stories', StoryViewSet, basename='story')
router.register(r'story-constellations', StoryConstellationViewSet, basename='story-constellation')
router.register(r'close-friends', CloseFriendViewSet, basename='close-friend')

urlpatterns = [
    path('', include(router.urls)),
] 