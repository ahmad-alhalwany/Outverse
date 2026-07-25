from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import SavedItemViewSet

router = DefaultRouter()
router.register(r'saved', SavedItemViewSet, basename='saved')

urlpatterns = [
    path('', include(router.urls)),
]
