from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CoinPackViewSet, CreateCoinCheckoutView, ShopItemViewSet, TipView

router = DefaultRouter()
router.register(r'items', ShopItemViewSet, basename='shopitem')
router.register(r'coin-packs', CoinPackViewSet, basename='coinpack')

urlpatterns = [
    path('tips/', TipView.as_view(), name='tips'),
    path('coin-checkout/', CreateCoinCheckoutView.as_view(), name='coin-checkout'),
    path('', include(router.urls)),
]
