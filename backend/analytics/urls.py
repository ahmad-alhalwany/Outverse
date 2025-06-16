from django.urls import path
from .views import PlatformAnalyticsView
 
urlpatterns = [
    path('platform/', PlatformAnalyticsView.as_view(), name='platform-analytics'),
] 