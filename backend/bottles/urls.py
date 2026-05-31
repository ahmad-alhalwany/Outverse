from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MessageBottleViewSet

router = DefaultRouter()
router.register(r'bottles', MessageBottleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
