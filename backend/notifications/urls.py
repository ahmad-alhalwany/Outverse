from django.urls import path

from .views import (
    MarketingCampaignDetailView,
    MarketingCampaignListCreateView,
    MarketingCampaignPreviewView,
    MarketingCampaignSendView,
    NotificationListView,
    NotificationBroadcastView,
    NotificationReadAllView,
    NotificationReadView,
    PushSubscribeView,
    PushVapidPublicKeyView,
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path(
        '<int:pk>/read/',
        NotificationReadView.as_view(),
        name='notification-read',
    ),
    path(
        'read_all/',
        NotificationReadAllView.as_view(),
        name='notification-read-all',
    ),
    path(
        'broadcast/',
        NotificationBroadcastView.as_view(),
        name='notification-broadcast',
    ),
    path(
        'push-subscribe/',
        PushSubscribeView.as_view(),
        name='notification-push-subscribe',
    ),
    path(
        'push-vapid-key/',
        PushVapidPublicKeyView.as_view(),
        name='notification-push-vapid-key',
    ),
    path(
        'marketing-campaigns/',
        MarketingCampaignListCreateView.as_view(),
        name='marketing-campaign-list',
    ),
    path(
        'marketing-campaigns/<int:pk>/',
        MarketingCampaignDetailView.as_view(),
        name='marketing-campaign-detail',
    ),
    path(
        'marketing-campaigns/<int:pk>/preview/',
        MarketingCampaignPreviewView.as_view(),
        name='marketing-campaign-preview',
    ),
    path(
        'marketing-campaigns/<int:pk>/send/',
        MarketingCampaignSendView.as_view(),
        name='marketing-campaign-send',
    ),
]
