from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CreateCheckoutSessionView,
    CreatorSubscriptionCheckoutView,
    CreatorSubscribersView,
    CreatorTierViewSet,
    MyCreatorSubscriptionsView,
    MySubscriptionView,
    StripeWebhookView,
    SubscriptionPlanViewSet,
)

router = DefaultRouter()
router.register(r'plans', SubscriptionPlanViewSet, basename='subscription-plan')
router.register(r'creator-tiers', CreatorTierViewSet, basename='creator-tier')

urlpatterns = [
    path('', include(router.urls)),
    path('me/', MySubscriptionView.as_view(), name='my-subscription'),
    path('checkout/', CreateCheckoutSessionView.as_view(), name='create-checkout-session'),
    path('webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    path('creator-subscriptions/checkout/', CreatorSubscriptionCheckoutView.as_view(), name='creator-sub-checkout'),
    path('creator-subscriptions/mine/', MyCreatorSubscriptionsView.as_view(), name='creator-sub-mine'),
    path('creator-subscriptions/subscribers/', CreatorSubscribersView.as_view(), name='creator-sub-subscribers'),
]
