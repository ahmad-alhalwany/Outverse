from django.urls import path

from .views import (
    AdminDashboardView,
    CreatorAnalyticsView,
    EngagementEventsView,
    PersonalAnalyticsView,
    PlatformAnalyticsView,
)

urlpatterns = [
    path('platform/', PlatformAnalyticsView.as_view(), name='platform-analytics'),
    path('dashboard/', AdminDashboardView.as_view(), name='admin-dashboard'),
    path('me/', PersonalAnalyticsView.as_view(), name='personal-analytics'),
    path('creator/', CreatorAnalyticsView.as_view(), name='creator-analytics'),
    path('events/', EngagementEventsView.as_view(), name='engagement-events'),
]