from django.urls import path
from .views import SystemHealthView
 
urlpatterns = [
    path('system/', SystemHealthView.as_view(), name='system-health'),
] 