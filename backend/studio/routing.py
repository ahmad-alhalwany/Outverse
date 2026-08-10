from django.urls import path

from .consumers import StudioConsumer

websocket_urlpatterns = [
    path('ws/studio/<int:session_id>/', StudioConsumer.as_asgi()),
]
