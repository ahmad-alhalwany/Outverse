from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import StoryViewSet

router = DefaultRouter()
router.register(r'stories', StoryViewSet, basename='narrative-story')

urlpatterns = [
    path('', include(router.urls)),
]
