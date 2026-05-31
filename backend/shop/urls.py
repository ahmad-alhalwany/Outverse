from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ShopItemViewSet

router = DefaultRouter()
router.register(r'items', ShopItemViewSet, basename='shopitem')

urlpatterns = [
    path('', include(router.urls)),
]
