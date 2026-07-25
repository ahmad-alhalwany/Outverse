from rest_framework.routers import DefaultRouter
from django.urls import include, path

from .views import TimeCapsuleViewSet

router = DefaultRouter()
router.register(r'capsules', TimeCapsuleViewSet, basename='time-capsule')

urlpatterns = [
    path('', include(router.urls)),
]
