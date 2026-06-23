from django.urls import path

from .views import AdminDashboardView, PlatformAnalyticsView

urlpatterns = [
    path('platform/', PlatformAnalyticsView.as_view(), name='platform-analytics'),
    path('dashboard/', AdminDashboardView.as_view(), name='admin-dashboard'),
] 