from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChallengeViewSet

router = DefaultRouter()
router.register(r'', ChallengeViewSet, basename='challenge')

urlpatterns = [
    path('', include(router.urls)),
] 