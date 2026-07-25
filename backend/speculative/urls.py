from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CharacterViewSet, DrawSessionViewSet, FailedIdeaViewSet, FutureMemoryViewSet

router = DefaultRouter()
router.register(r'failed-ideas', FailedIdeaViewSet, basename='failed-idea')
router.register(r'draw-sessions', DrawSessionViewSet, basename='draw-session')
router.register(r'future-memories', FutureMemoryViewSet, basename='future-memory')
router.register(r'characters', CharacterViewSet, basename='character')

urlpatterns = [
    path('', include(router.urls)),
]
