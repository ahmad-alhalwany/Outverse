from django.urls import path

from .consumers import ChatConsumer, RoomChatConsumer, SignalConsumer
from posts.consumers import PostCommentsConsumer
from reels.consumers import ReelCommentsConsumer
from reels.live_consumers import LiveSessionConsumer
from notifications.consumers import NotificationConsumer

websocket_urlpatterns = [
    path('ws/chat/<int:conversation_id>/', ChatConsumer.as_asgi()),
    path('ws/room/<int:room_id>/', RoomChatConsumer.as_asgi()),
    path('ws/signal/', SignalConsumer.as_asgi()),
    path('ws/notifications/', NotificationConsumer.as_asgi()),
    path('ws/posts/<int:post_id>/comments/', PostCommentsConsumer.as_asgi()),
    path('ws/reels/<int:reel_id>/comments/', ReelCommentsConsumer.as_asgi()),
    path('ws/live/<int:session_id>/', LiveSessionConsumer.as_asgi()),
]
