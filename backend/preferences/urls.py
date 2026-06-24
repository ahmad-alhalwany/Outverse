from django.urls import path

from .views import UserPreferencesView


urlpatterns = [
    path('', UserPreferencesView.as_view(), name='user-preferences'),
]
