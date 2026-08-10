from django.urls import path

from .consumers import ForgeStoryConsumer

websocket_urlpatterns = [
    path('ws/forge/story/<int:story_id>/', ForgeStoryConsumer.as_asgi()),
]
