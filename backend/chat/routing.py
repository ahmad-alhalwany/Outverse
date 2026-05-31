from django.urls import path

from .consumers import ChatConsumer, RoomChatConsumer, SignalConsumer

websocket_urlpatterns = [
    path('ws/chat/<int:conversation_id>/', ChatConsumer.as_asgi()),
    path('ws/room/<int:room_id>/', RoomChatConsumer.as_asgi()),
    path('ws/signal/', SignalConsumer.as_asgi()),
]
