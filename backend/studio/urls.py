from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DrawSessionViewSet

router = DefaultRouter()
router.register(r'sessions', DrawSessionViewSet, basename='draw-session')

urlpatterns = [
    path('', include(router.urls)),
]
