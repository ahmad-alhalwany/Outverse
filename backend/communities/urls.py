from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CommunityViewSet

router = DefaultRouter()
router.register(r'', CommunityViewSet, basename='community')

urlpatterns = [
    path('', include(router.urls)),
]
