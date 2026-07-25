from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdCampaignViewSet,
    AdCreativeViewSet,
    AdViewSet,
    AdDeliveryViewSet,
    AdReportViewSet,
)

router = DefaultRouter()
router.register(r'campaigns', AdCampaignViewSet, basename='ad-campaign')
router.register(r'creatives', AdCreativeViewSet, basename='ad-creative')
router.register(r'ads', AdViewSet, basename='ad')
router.register(r'delivery', AdDeliveryViewSet, basename='ad-delivery')
router.register(r'reports', AdReportViewSet, basename='ad-report')

urlpatterns = [
    path('', include(router.urls)),
]